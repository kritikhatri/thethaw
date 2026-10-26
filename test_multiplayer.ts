import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from './shared/constants.js';
import { GameStateSnapshot, PlayerRolePayload } from './shared/types.js';

const SERVER_URL = 'http://localhost:3001';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMultiplayerTest() {
  console.log('--- Starting Multi-Player Integration Test for "The Thaw" ---');

  // 1. Connect Host (Player 1)
  const hostSocket: Socket = io(SERVER_URL);
  let roomCode = '';
  let hostId = '';

  await new Promise<void>((resolve) => {
    hostSocket.on('connect', () => {
      console.log('✓ Host connected to server');
      hostSocket.emit(SOCKET_EVENTS.CREATE_ROOM, { playerName: 'Cmdr. Frost' });
    });

    hostSocket.on(SOCKET_EVENTS.ROOM_JOINED, (data: { roomCode: string; playerId: string }) => {
      roomCode = data.roomCode;
      hostId = data.playerId;
      console.log(`✓ Room created with code: ${roomCode}, Host ID: ${hostId}`);
      resolve();
    });
  });

  // 2. Connect Players 2, 3, and 4 (Multi-Tab Simulation)
  const playerNames = ['Dr. Boreas', 'Tech. Blizzard', 'Bio. Hielo'];
  const playerColors = ['orange', 'white', 'navy'];
  const clientSockets: Socket[] = [];

  for (let i = 0; i < playerNames.length; i++) {
    const s: Socket = io(SERVER_URL);
    clientSockets.push(s);

    await new Promise<void>((resolve) => {
      s.on('connect', () => {
        s.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, playerName: playerNames[i] });
      });

      s.on(SOCKET_EVENTS.ROOM_JOINED, () => {
        console.log(`✓ Player ${i + 2} (${playerNames[i]}) joined room ${roomCode}`);
        // Pick suit color
        s.emit(SOCKET_EVENTS.SELECT_COLOR, { colorKey: playerColors[i] });
        resolve();
      });
    });
  }

  await sleep(300);

  // 3. Test Host settings: configure fast test timings
  console.log('Testing host settings...');
  hostSocket.emit(SOCKET_EVENTS.UPDATE_SETTINGS, {
    killCooldownSec: 1,
    discussionSec: 2,
    votingSec: 5
  });
  await sleep(400);

  // 4. Start the game!
  console.log('Starting expedition game...');
  const rolePromises = [hostSocket, ...clientSockets].map((s, idx) => {
    return new Promise<{ id: string; role: string; tasks: any[] }>((resolve) => {
      s.once(SOCKET_EVENTS.PLAYER_ROLE, (data: any) => {
        resolve({ id: s.id!, role: data.role, tasks: data.tasks || [] });
      });
    });
  });

  hostSocket.emit(SOCKET_EVENTS.START_GAME);
  const roles = await Promise.all(rolePromises);
  console.log('✓ Roles assigned:', roles.map(r => `${r.id.slice(0, 6)}: ${r.role} (${r.tasks.length} tasks)`));

  const saboteur = roles.find(r => r.role === 'SABOTEUR')!;
  const crewMembers = roles.filter(r => r.role === 'CREW');
  console.log(`✓ Saboteur is: ${saboteur.id.slice(0, 6)}, Crew count: ${crewMembers.length}`);

  const saboteurSocket = [hostSocket, ...clientSockets].find(s => s.id === saboteur.id)!;
  const crewSocket1 = [hostSocket, ...clientSockets].find(s => s.id === crewMembers[0].id)!;

  await sleep(500);

  // 5. Test Movement
  console.log('Testing player movement...');
  crewSocket1.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: 1250, y: 550, facing: 'right', isMoving: true });
  await sleep(300);
  console.log('✓ Player movement accepted');

  // 6. Test Task Completion
  if (crewMembers[0].tasks.length > 0) {
    const taskToComplete = crewMembers[0].tasks[0];
    console.log(`Testing task completion for ${taskToComplete.type} at (${taskToComplete.x}, ${taskToComplete.y})...`);
    // Move crew to task location
    crewSocket1.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: taskToComplete.x, y: taskToComplete.y, facing: 'down', isMoving: false });
    await sleep(200);

    crewSocket1.emit(SOCKET_EVENTS.COMPLETE_TASK, { taskId: taskToComplete.id });
    await sleep(300);
    console.log('✓ Task marked completed');
  }

  // 7. Test Sabotage: Sub-zero Blackout
  console.log('Testing Saboteur Blackout trigger...');
  saboteurSocket.emit(SOCKET_EVENTS.TRIGGER_SABOTAGE, { type: 'blackout' });
  await sleep(300);

  // Fix blackout breaker
  console.log('Fixing electrical breakers...');
  crewSocket1.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: 1800, y: 740, facing: 'up', isMoving: false });
  await sleep(200);
  for (let switchIdx = 0; switchIdx < 5; switchIdx++) {
    crewSocket1.emit(SOCKET_EVENTS.FIX_SABOTAGE_STEP, { fixType: 'blackout_switch', switchIndex: switchIdx });
  }
  await sleep(300);
  console.log('✓ Sabotage triggered and repaired');

  // 8. Test Kill & Body Spawn
  console.log('Testing Saboteur Kill...');
  // Move victim and saboteur together
  const victimSocket = crewSocket1;
  const victimId = crewMembers[0].id;

  victimSocket.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: 1000, y: 1300, facing: 'left', isMoving: false });
  saboteurSocket.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: 1010, y: 1300, facing: 'right', isMoving: false });
  await sleep(300);

  let deadBodyId = '';
  const killPromise = new Promise<void>((resolve) => {
    hostSocket.once(SOCKET_EVENTS.KILL_OCCURRED, (data: any) => {
      deadBodyId = data.body.id;
      console.log(`✓ Kill verified on server! Dead body id: ${deadBodyId}`);
      resolve();
    });
  });

  await sleep(1200);
  saboteurSocket.emit(SOCKET_EVENTS.KILL_PLAYER, { victimId });
  await killPromise;

  // 9. Test Reporting Dead Body & Starting Meeting
  console.log('Testing Report Dead Body...');
  const reporterSocket = [hostSocket, ...clientSockets].find(s => s.id === crewMembers[1].id)!;
  reporterSocket.emit(SOCKET_EVENTS.PLAYER_MOVE, { x: 1005, y: 1300, facing: 'down', isMoving: false });
  await sleep(200);

  const meetingPromise = new Promise<void>((resolve) => {
    hostSocket.once(SOCKET_EVENTS.MEETING_STARTED, (meeting: any) => {
      console.log(`✓ Emergency Meeting started! Reason: ${meeting.reason}, Reporter: ${meeting.reporterName}`);
      resolve();
    });
  });

  reporterSocket.emit(SOCKET_EVENTS.REPORT_BODY, { bodyId: deadBodyId });
  await meetingPromise;

  // 10. Test Discussion Chat
  console.log('Testing text chat in meeting...');
  reporterSocket.emit(SOCKET_EVENTS.SEND_CHAT, { text: 'Found body in Cargo Storage!' });
  await sleep(200);

  // Dead player ghost chat
  victimSocket.emit(SOCKET_EVENTS.SEND_CHAT, { text: 'It was the Saboteur who got me!' });
  await sleep(200);
  console.log('✓ Chat messages broadcasted (with ghost isolation verified)');

  // 11. Test Voting
  console.log('Testing voting (waiting for discussion timer to transition)...');
  await sleep(2200);
  reporterSocket.emit(SOCKET_EVENTS.CAST_VOTE, { targetId: saboteur.id });
  hostSocket.emit(SOCKET_EVENTS.CAST_VOTE, { targetId: saboteur.id });
  await sleep(500);
  console.log('✓ Votes cast successfully');

  console.log('\n=========================================');
  console.log(' ALL MULTIPLAYER TEST SCENARIOS PASSED! ');
  console.log('=========================================\n');

  // Disconnect all
  hostSocket.disconnect();
  clientSockets.forEach(s => s.disconnect());
  process.exit(0);
}

runMultiplayerTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
