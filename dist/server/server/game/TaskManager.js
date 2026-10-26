import { TASK_CONSOLES, ROOMS, INTERACTION_DISTANCES } from '../../shared/constants.js';
export class TaskManager {
    /**
     * Generate 4 random distinct tasks for a crew member
     */
    static generateTasksForPlayer(playerId) {
        // Shuffle available consoles
        const shuffled = [...TASK_CONSOLES].sort(() => Math.random() - 0.5);
        // Pick up to 4 consoles ensuring diversity of task types
        const selectedConsoles = [];
        const usedTypes = new Set();
        for (const c of shuffled) {
            if (selectedConsoles.length >= 4)
                break;
            if (!usedTypes.has(c.type)) {
                selectedConsoles.push(c);
                usedTypes.add(c.type);
            }
        }
        // If less than 4, fill with remaining
        for (const c of shuffled) {
            if (selectedConsoles.length >= 4)
                break;
            if (!selectedConsoles.some(sc => sc.id === c.id)) {
                selectedConsoles.push(c);
            }
        }
        return selectedConsoles.map((c, index) => {
            const room = ROOMS.find(r => r.id === c.roomId);
            return {
                id: `${playerId}_task_${index}_${c.id}`,
                type: c.type,
                roomId: c.roomId,
                roomName: room ? room.name : c.roomId,
                x: c.x,
                y: c.y,
                completed: false
            };
        });
    }
    /**
     * Validate that a player is within range of the console and complete it
     */
    static validateAndComplete(playerX, playerY, tasks, taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.completed)
            return false;
        const dist = Math.hypot(playerX - task.x, playerY - task.y);
        if (dist > INTERACTION_DISTANCES.TASK + 40) {
            // Allow slight latency tolerance (+40px)
            return false;
        }
        task.completed = true;
        return true;
    }
}
