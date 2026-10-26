import { GameRoom } from './GameRoom.js';
export class RoomManager {
    io;
    rooms = new Map();
    socketToRoom = new Map();
    constructor(io) {
        this.io = io;
    }
    createRoom(socket, playerName) {
        const code = this.generateUniqueCode();
        const room = new GameRoom(code, this.io);
        this.rooms.set(code, room);
        this.joinRoom(socket, code, playerName);
        return room;
    }
    joinRoom(socket, code, playerName) {
        const normalizedCode = code.trim().toUpperCase();
        const room = this.rooms.get(normalizedCode);
        if (!room)
            return null;
        socket.join(normalizedCode);
        this.socketToRoom.set(socket.id, normalizedCode);
        room.addPlayer(socket.id, playerName);
        return room;
    }
    leaveRoom(socket) {
        const code = this.socketToRoom.get(socket.id);
        if (!code)
            return;
        this.socketToRoom.delete(socket.id);
        socket.leave(code);
        const room = this.rooms.get(code);
        if (room) {
            room.removePlayer(socket.id);
            // Clean up empty room if no active human players remain
            if (!room.hasActivePlayers()) {
                room.destroy();
                this.rooms.delete(code);
            }
        }
    }
    getRoomBySocket(socketId) {
        const code = this.socketToRoom.get(socketId);
        if (!code)
            return null;
        return this.rooms.get(code) || null;
    }
    generateUniqueCode() {
        const words = ['THAW', 'FROZ', 'COLD', 'SNOW', 'GLAC', 'ICEE', 'ZERO', 'HAIL', 'POLR', 'NEVE'];
        for (const w of words) {
            if (!this.rooms.has(w))
                return w;
        }
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(code));
        return code;
    }
}
