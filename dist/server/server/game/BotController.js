export const STATION_WAYPOINTS = {
    mess_hall: { id: 'mess_hall', x: 1200, y: 500, neighbors: ['node_mess_lab', 'node_mess_med', 'node_mess_storage', 'node_mess_hydro'] },
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
export class BotController {
    botId;
    currentWaypointId = 'mess_hall';
    targetWaypointId = 'storage';
    path = [];
    taskPauseTimer = 0;
    targetTask = null;
    voteTimer = 0;
    hasVotedThisMeeting = false;
    hasChattedThisMeeting = false;
    constructor(botId) {
        this.botId = botId;
        this.pickNextDestination();
    }
    resetForMeeting() {
        this.hasVotedThisMeeting = false;
        this.hasChattedThisMeeting = false;
        this.voteTimer = 3 + Math.random() * 8; // Vote within 3-11s into voting
    }
    shouldChat() {
        if (!this.hasChattedThisMeeting && Math.random() < 0.6) {
            this.hasChattedThisMeeting = true;
            return true;
        }
        return false;
    }
    getRandomChatMessage(reporterName, isSaboteur) {
        const crewChats = [
            "Where was the body found?",
            `Did anyone see who was near ${reporterName}?`,
            "I was doing wires in storage.",
            "Skip for now unless someone saw something.",
            "Suspect list is still too wide.",
            "I was in the lab downloading telemetry.",
            "Anyone have visual proof?"
        ];
        const saboteurChats = [
            "I was with someone in reactor, all clear there.",
            "Could be a self report?",
            "Let's skip and watch each other.",
            "I was heading to life support."
        ];
        const pool = isSaboteur ? [...crewChats, ...saboteurChats] : crewChats;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    tickVote(deltaSec, candidateIds) {
        if (this.hasVotedThisMeeting)
            return null;
        this.voteTimer -= deltaSec;
        if (this.voteTimer <= 0) {
            this.hasVotedThisMeeting = true;
            // 30% chance to skip, 70% chance to vote a candidate
            if (Math.random() < 0.3 || candidateIds.length === 0) {
                return 'skip';
            }
            return candidateIds[Math.floor(Math.random() * candidateIds.length)];
        }
        return null;
    }
    updateMovement(bot, tasks, deltaSec) {
        if (bot.status !== 'ALIVE') {
            return { newX: bot.x, newY: bot.y, isMoving: false, facing: bot.facing };
        }
        // If currently paused doing a task
        if (this.taskPauseTimer > 0) {
            this.taskPauseTimer -= deltaSec;
            if (this.taskPauseTimer <= 0) {
                const completedId = this.targetTask ? this.targetTask.id : undefined;
                this.targetTask = null;
                this.pickNextDestination(tasks);
                return {
                    newX: bot.x,
                    newY: bot.y,
                    isMoving: false,
                    facing: bot.facing,
                    completedTaskId: completedId
                };
            }
            return { newX: bot.x, newY: bot.y, isMoving: false, facing: bot.facing };
        }
        // Need next waypoint?
        if (this.path.length === 0) {
            this.findPathTo(this.targetWaypointId);
            if (this.path.length === 0) {
                this.pickNextDestination(tasks);
                this.findPathTo(this.targetWaypointId);
            }
        }
        if (this.path.length === 0) {
            return { newX: bot.x, newY: bot.y, isMoving: false, facing: bot.facing };
        }
        const nextNodeId = this.path[0];
        const targetNode = STATION_WAYPOINTS[nextNodeId];
        if (!targetNode) {
            this.path.shift();
            return { newX: bot.x, newY: bot.y, isMoving: false, facing: bot.facing };
        }
        const dx = targetNode.x - bot.x;
        const dy = targetNode.y - bot.y;
        const dist = Math.hypot(dx, dy);
        const speed = 160; // px/sec
        let facing = bot.facing;
        if (Math.abs(dx) > Math.abs(dy)) {
            facing = dx < 0 ? 'left' : 'right';
        }
        else {
            facing = dy < 0 ? 'up' : 'down';
        }
        if (dist < 15) {
            // Arrived at waypoint
            this.currentWaypointId = nextNodeId;
            this.path.shift();
            // Check if reached destination
            if (this.path.length === 0) {
                // If arrived at task room, simulate doing task
                const uncompleted = tasks.find(t => !t.completed && t.roomId === this.currentWaypointId);
                if (uncompleted && Math.random() < 0.8) {
                    this.targetTask = uncompleted;
                    this.taskPauseTimer = 3.5 + Math.random() * 3.0; // 3.5 to 6.5s to do task
                    return { newX: targetNode.x, newY: targetNode.y, isMoving: false, facing };
                }
                else {
                    this.pickNextDestination(tasks);
                }
            }
            return { newX: targetNode.x, newY: targetNode.y, isMoving: true, facing };
        }
        const step = Math.min(dist, speed * deltaSec);
        const newX = bot.x + (dx / dist) * step;
        const newY = bot.y + (dy / dist) * step;
        return { newX, newY, isMoving: true, facing };
    }
    pickNextDestination(tasks = []) {
        const uncompleted = tasks.filter(t => !t.completed);
        if (uncompleted.length > 0 && Math.random() < 0.65) {
            const task = uncompleted[Math.floor(Math.random() * uncompleted.length)];
            if (STATION_WAYPOINTS[task.roomId]) {
                this.targetWaypointId = task.roomId;
                return;
            }
        }
        // Pick random room waypoint
        const roomKeys = ['mess_hall', 'cryo_lab', 'medbay', 'reactor', 'storage', 'engine_room', 'electrical', 'hydroponics'];
        const candidates = roomKeys.filter(k => k !== this.currentWaypointId);
        this.targetWaypointId = candidates[Math.floor(Math.random() * candidates.length)];
    }
    findPathTo(targetId) {
        if (this.currentWaypointId === targetId)
            return;
        // BFS search through STATION_WAYPOINTS graph
        const queue = [{ id: this.currentWaypointId, path: [] }];
        const visited = new Set([this.currentWaypointId]);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.id === targetId) {
                this.path = current.path;
                return;
            }
            const node = STATION_WAYPOINTS[current.id];
            if (node) {
                for (const neighborId of node.neighbors) {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push({ id: neighborId, path: [...current.path, neighborId] });
                    }
                }
            }
        }
    }
}
