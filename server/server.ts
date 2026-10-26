import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { SOCKET_EVENTS } from '../shared/constants.js';
import { RoomManager } from './game/RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;
const roomManager = new RoomManager(io);

// Production static file serving
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Create room
  socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ playerName }) => {
    roomManager.createRoom(socket, playerName);
  });

  // Join room
  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ roomCode, playerName }) => {
    const room = roomManager.joinRoom(socket, roomCode, playerName);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR_MSG, { message: `Room "${roomCode}" not found.` });
    }
  });

  // Color selection
  socket.on(SOCKET_EVENTS.SELECT_COLOR, ({ colorKey }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.selectColor(socket.id, colorKey);
    }
  });

  // Bot management
  socket.on(SOCKET_EVENTS.ADD_BOT, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.addBot();
    }
  });

  socket.on(SOCKET_EVENTS.REMOVE_BOT, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.removeBot();
    }
  });

  // Settings update
  socket.on(SOCKET_EVENTS.UPDATE_SETTINGS, (settings) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.updateSettings(socket.id, settings);
    }
  });

  // Start game
  socket.on(SOCKET_EVENTS.START_GAME, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      const res = room.startGame(socket.id);
      if (!res.success && res.message) {
        socket.emit(SOCKET_EVENTS.ERROR_MSG, { message: res.message });
      }
    }
  });

  // Movement
  socket.on(SOCKET_EVENTS.PLAYER_MOVE, ({ x, y, facing, isMoving }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handlePlayerMove(socket.id, x, y, facing, isMoving);
    }
  });

  // Vents
  socket.on(SOCKET_EVENTS.USE_VENT, ({ targetVentId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleUseVent(socket.id, targetVentId);
    }
  });

  // Kills
  socket.on(SOCKET_EVENTS.KILL_PLAYER, ({ victimId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleKill(socket.id, victimId);
    }
  });

  // Tasks
  socket.on(SOCKET_EVENTS.COMPLETE_TASK, ({ taskId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleCompleteTask(socket.id, taskId);
    }
  });

  // Reports
  socket.on(SOCKET_EVENTS.REPORT_BODY, ({ bodyId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleReportBody(socket.id, bodyId);
    }
  });

  // Emergency
  socket.on(SOCKET_EVENTS.TRIGGER_EMERGENCY, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleEmergency(socket.id);
    }
  });

  // Chat
  socket.on(SOCKET_EVENTS.SEND_CHAT, ({ text }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleChat(socket.id, text);
    }
  });

  // Votes
  socket.on(SOCKET_EVENTS.CAST_VOTE, ({ targetId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleCastVote(socket.id, targetId);
    }
  });

  // Sabotage triggers
  socket.on(SOCKET_EVENTS.TRIGGER_SABOTAGE, ({ type }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleTriggerSabotage(socket.id, type);
    }
  });

  // Sabotage fixes
  socket.on(SOCKET_EVENTS.FIX_SABOTAGE_STEP, ({ fixType, switchIndex }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleFixSabotageStep(socket.id, fixType, switchIndex);
    }
  });

  // Return to lobby
  socket.on(SOCKET_EVENTS.RETURN_TO_LOBBY, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.returnToLobby(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket);
  });
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[The Thaw Server] Listening on http://localhost:${PORT}`);
});
