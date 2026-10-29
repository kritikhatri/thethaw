import { Facing, PlayerPublic } from '../../shared/types.js';
import { StationMapServer } from './StationMapServer.js';

interface BotPathNode {
  id: string;
  x: number;
  y: number;
  neighbors: string[];
}

interface Point {
  x: number;
  y: number;
}

export const STATION_WAYPOINTS: Record<string, BotPathNode> = {
  mess_hall: { id: 'mess_hall', x: 1200, y: 720, neighbors: ['node_mess_lab', 'node_mess_med', 'node_mess_storage', 'node_mess_hydro'] },
  node_mess_lab: { id: 'node_mess_lab', x: 850, y: 430, neighbors: ['mess_hall', 'cryo_lab'] },
  cryo_lab: { id: 'cryo_lab', x: 640, y: 310, neighbors: ['node_mess_lab'] },
  node_mess_med: { id: 'node_mess_med', x: 800, y: 670, neighbors: ['mess_hall', 'medbay'] },
  medbay: { id: 'medbay', x: 480, y: 720, neighbors: ['node_mess_med', 'node_med_reactor'] },
  node_med_reactor: { id: 'node_med_reactor', x: 440, y: 1010, neighbors: ['medbay', 'reactor'] },
  reactor: { id: 'reactor', x: 490, y: 1330, neighbors: ['node_med_reactor', 'node_reactor_storage'] },
  node_reactor_storage: { id: 'node_reactor_storage', x: 840, y: 1350, neighbors: ['reactor', 'storage'] },
  storage: { id: 'storage', x: 1200, y: 1390, neighbors: ['node_reactor_storage', 'node_mess_storage', 'node_storage_engine'] },
  node_mess_storage: { id: 'node_mess_storage', x: 1200, y: 975, neighbors: ['mess_hall', 'storage'] },
  node_storage_engine: { id: 'node_storage_engine', x: 1560, y: 1350, neighbors: ['storage', 'engine_room'] },
  engine_room: { id: 'engine_room', x: 1920, y: 1330, neighbors: ['node_storage_engine', 'node_engine_elec'] },
  node_engine_elec: { id: 'node_engine_elec', x: 1830, y: 1035, neighbors: ['engine_room', 'electrical'] },
  electrical: { id: 'electrical', x: 1800, y: 840, neighbors: ['node_engine_elec', 'node_elec_hydro'] },
  node_elec_hydro: { id: 'node_elec_hydro', x: 1830, y: 635, neighbors: ['electrical', 'hydroponics'] },
  hydroponics: { id: 'hydroponics', x: 1880, y: 410, neighbors: ['node_elec_hydro', 'node_mess_hydro'] },
  node_mess_hydro: { id: 'node_mess_hydro', x: 1575, y: 490, neighbors: ['mess_hall', 'hydroponics'] }
};

const ROOM_NODES = ['mess_hall', 'cryo_lab', 'medbay', 'reactor', 'storage', 'engine_room', 'electrical', 'hydroponics'];

// Bots are a touch slower than humans so a skilled player can always outrun or catch them
const BOT_SPEED = { RUNNER: 180, HUNTER: 190 };
const FLEE_RADIUS = 280;
const REPLAN_SEC = 0.4;

export class BotController {
  private path: Point[] = [];
  private replanTimer = 0;
  private wanderNodeId: string = ROOM_NODES[0];
  // Some bots are heroes who rush to thaw teammates, others play it safe
  private bravery = 0.4 + Math.random() * 0.6;

  public reset(): void {
    this.path = [];
    this.replanTimer = 0;
    this.pickWanderNode();
  }

  public update(
    bot: PlayerPublic,
    everyone: PlayerPublic[],
    deltaSec: number
  ): { x: number; y: number; isMoving: boolean; facing: Facing } {
    this.replanTimer -= deltaSec;
    if (this.replanTimer <= 0) {
      this.replanTimer = REPLAN_SEC;
      const goal = bot.role === 'HUNTER' ? this.hunterGoal(bot, everyone) : this.runnerGoal(bot, everyone);
      this.path = this.planPath(bot, goal);
    }

    let target = this.path[0];
    while (target && Math.hypot(target.x - bot.x, target.y - bot.y) < 12) {
      this.path.shift();
      target = this.path[0];
    }

    if (!target) {
      this.pickWanderNode();
      this.replanTimer = 0;
      return { x: bot.x, y: bot.y, isMoving: false, facing: bot.facing };
    }

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, BOT_SPEED[bot.role] * deltaSec);
    const moved = StationMapServer.validateMovement(bot.x, bot.y, bot.x + (dx / dist) * step, bot.y + (dy / dist) * step);

    const facing: Facing = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');

    return { x: moved.x, y: moved.y, isMoving: true, facing };
  }

  private hunterGoal(bot: PlayerPublic, everyone: PlayerPublic[]): Point {
    const prey = this.nearest(bot, everyone.filter(p =>
      p.role === 'RUNNER' && p.status === 'ALIVE' && p.immuneFor <= 0
    ));
    return prey ?? this.wanderPoint(bot);
  }

  private runnerGoal(bot: PlayerPublic, everyone: PlayerPublic[]): Point {
    const hunter = this.nearest(bot, everyone.filter(p => p.role === 'HUNTER' && p.status === 'ALIVE'));
    if (hunter && Math.hypot(hunter.x - bot.x, hunter.y - bot.y) < FLEE_RADIUS) {
      return this.fleePoint(bot, hunter);
    }

    const frozen = this.nearest(bot, everyone.filter(p => p.status === 'FROZEN'));
    if (frozen && Math.random() < this.bravery) {
      return frozen;
    }

    return this.wanderPoint(bot);
  }

  // Run to whichever node next to us leads furthest from the hunter
  private fleePoint(bot: PlayerPublic, hunter: Point): Point {
    const here = this.nearestNode(bot);
    const options = [here, ...here.neighbors.map(id => STATION_WAYPOINTS[id])];
    let best = here;
    let bestScore = -Infinity;
    for (const node of options) {
      const score = Math.hypot(node.x - hunter.x, node.y - hunter.y) - Math.hypot(node.x - bot.x, node.y - bot.y) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  private wanderPoint(bot: PlayerPublic): Point {
    const node = STATION_WAYPOINTS[this.wanderNodeId];
    if (Math.hypot(node.x - bot.x, node.y - bot.y) < 30) {
      this.pickWanderNode();
    }
    return STATION_WAYPOINTS[this.wanderNodeId];
  }

  private pickWanderNode(): void {
    const candidates = ROOM_NODES.filter(k => k !== this.wanderNodeId);
    this.wanderNodeId = candidates[Math.floor(Math.random() * candidates.length)];
  }

  private nearest<T extends Point>(from: Point, candidates: T[]): T | null {
    let best: T | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - from.x, c.y - from.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private nearestNode(p: Point): BotPathNode {
    return this.nearest(p, Object.values(STATION_WAYPOINTS))!;
  }

  /**
   * BFS through the waypoint graph, then a final straight leg to the goal itself
   */
  private planPath(bot: PlayerPublic, goal: Point): Point[] {
    const start = this.nearestNode(bot);
    const end = this.nearestNode(goal);

    const queue: { id: string; path: string[] }[] = [{ id: start.id, path: [start.id] }];
    const visited = new Set<string>([start.id]);
    let nodeIds: string[] = [start.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.id === end.id) {
        nodeIds = current.path;
        break;
      }
      for (const neighborId of STATION_WAYPOINTS[current.id].neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, path: [...current.path, neighborId] });
        }
      }
    }

    const points: Point[] = nodeIds.map(id => STATION_WAYPOINTS[id]);

    // Skip the first node if we're already past it on the way to the second
    if (points.length > 1) {
      const [first, second] = points;
      if (Math.hypot(second.x - bot.x, second.y - bot.y) < Math.hypot(second.x - first.x, second.y - first.y)) {
        points.shift();
      }
    }

    points.push({ x: goal.x, y: goal.y });
    return points;
  }
}
