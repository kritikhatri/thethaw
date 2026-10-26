import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.js';

export class RoomManager {
  private io: Server;
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public createRoom(socket: Socket, playerName: string): GameRoom {
    const code = this.generateUniqueCode();
    const room = new GameRoom(code, this.io);
    this.rooms.set(code, room);
    socket.join(code);
    this.socketToRoom.set(socket.id, code);
    socket.emit('room_joined', { roomCode: code, playerId: socket.id });
    room.addPlayer(socket.id, playerName);
    return room;
  }

  public joinRoom(socket: Socket, code: string, playerName: string): GameRoom | null {
    const normalizedCode = code.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) return null;

    socket.join(normalizedCode);
    this.socketToRoom.set(socket.id, normalizedCode);
    socket.emit('room_joined', { roomCode: normalizedCode, playerId: socket.id });
    room.addPlayer(socket.id, playerName);

    return room;
  }

  public leaveRoom(socket: Socket): void {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

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

  public getRoomBySocket(socketId: string): GameRoom | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) || null;
  }

  private generateUniqueCode(): string {
    const words = ['THAW', 'FROZ', 'COLD', 'SNOW', 'GLAC', 'ICEE', 'ZERO', 'HAIL', 'POLR', 'NEVE'];
    for (const w of words) {
      if (!this.rooms.has(w)) return w;
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
