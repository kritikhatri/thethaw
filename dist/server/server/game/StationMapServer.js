import { ROOMS, CORRIDORS, EMERGENCY_TABLE, VENTS } from '../../shared/constants.js';
export class StationMapServer {
    static playerRadius = 16;
    /**
     * Check if position is walkable (inside any room or corridor and not inside obstacles)
     */
    static isWalkable(x, y) {
        const r = this.playerRadius;
        // Check emergency table obstacle in mess hall
        const distSqToTable = (x - EMERGENCY_TABLE.x) ** 2 + (y - EMERGENCY_TABLE.y) ** 2;
        if (distSqToTable < (EMERGENCY_TABLE.radius + r) ** 2) {
            return false;
        }
        // Check if inside any room
        for (const room of ROOMS) {
            if (x >= room.x + r &&
                x <= room.x + room.width - r &&
                y >= room.y + r &&
                y <= room.y + room.height - r) {
                return true;
            }
        }
        // Check if inside any corridor
        for (const corridor of CORRIDORS) {
            if (x >= corridor.x + r &&
                x <= corridor.x + corridor.width - r &&
                y >= corridor.y + r &&
                y <= corridor.y + corridor.height - r) {
                return true;
            }
        }
        return false;
    }
    /**
     * Clamp or slide position against walkable bounds
     */
    static validateMovement(oldX, oldY, newX, newY, maxStep = 20) {
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
    static getRoomAt(x, y) {
        for (const room of ROOMS) {
            if (x >= room.x &&
                x <= room.x + room.width &&
                y >= room.y &&
                y <= room.y + room.height) {
                return room.id;
            }
        }
        return null;
    }
    /**
     * Find nearest vent within radius
     */
    static getNearestVent(x, y, maxDist) {
        let nearest = null;
        let minD = maxDist;
        for (const vent of VENTS) {
            const d = Math.hypot(vent.x - x, vent.y - y);
            if (d < minD) {
                minD = d;
                nearest = vent;
            }
        }
        return nearest;
    }
}
