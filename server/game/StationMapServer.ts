import { ROOMS, CORRIDORS, EMERGENCY_TABLE } from '../../shared/constants.js';

export class StationMapServer {
  private static playerRadius = 16;

  /**
   * Check if position is walkable (inside any room or corridor and not inside obstacles)
   */
  public static isWalkable(x: number, y: number): boolean {
    const r = this.playerRadius;

    // Check emergency table obstacle in mess hall
    const distSqToTable = (x - EMERGENCY_TABLE.x) ** 2 + (y - EMERGENCY_TABLE.y) ** 2;
    if (distSqToTable < (EMERGENCY_TABLE.radius + r) ** 2) {
      return false;
    }

    // Check if inside any room
    for (const room of ROOMS) {
      if (
        x >= room.x + r &&
        x <= room.x + room.width - r &&
        y >= room.y + r &&
        y <= room.y + room.height - r
      ) {
        return true;
      }
    }

    // Check if inside any corridor
    // Corridor ends open into rooms, so only the side walls keep the radius margin
    for (const corridor of CORRIDORS) {
      const isHorizontal = corridor.width > corridor.height;
      const marginX = isHorizontal ? 0 : r;
      const marginY = isHorizontal ? r : 0;
      if (
        x >= corridor.x + marginX &&
        x <= corridor.x + corridor.width - marginX &&
        y >= corridor.y + marginY &&
        y <= corridor.y + corridor.height - marginY
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check that a straight walk between two points stays on walkable ground
   */
  public static hasClearPath(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 12);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)) return false;
    }
    return true;
  }

  /**
   * Clamp or slide position against walkable bounds
   */
  public static validateMovement(oldX: number, oldY: number, newX: number, newY: number, maxStep = 20): { x: number; y: number } {
    // If destination is walkable, accept it
    if (this.isWalkable(newX, newY)) {
      return { x: newX, y: newY };
    }

    // Try sliding horizontally
    if (this.isWalkable(newX, oldY)) {
      return { x: newX, y: oldY };
    }

    // Try sliding vertically
    if (this.isWalkable(oldX, newY)) {
      return { x: oldX, y: newY };
    }

    // Revert to old position
    return { x: oldX, y: oldY };
  }

  /**
   * Get room at position
   */
  public static getRoomAt(x: number, y: number): string | null {
    for (const room of ROOMS) {
      if (
        x >= room.x &&
        x <= room.x + room.width &&
        y >= room.y &&
        y <= room.y + room.height
      ) {
        return room.id;
      }
    }
    return null;
  }
}
