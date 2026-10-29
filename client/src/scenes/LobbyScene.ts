import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { COLORS, MIN_PLAYERS, SOCKET_EVENTS } from '@shared/constants';
import { GameStateSnapshot } from '@shared/types';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';

export class LobbyScene extends Phaser.Scene {
  private socket!: Socket;
  private myPlayerId: string = '';
  private currentRoomCode: string | null = null;
  private selectedColorKey: string = 'cyan';
  private playerName: string = '';
  private uiLayer!: HTMLElement;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.uiLayer = document.getElementById('ui-layer')!;
    this.uiLayer.innerHTML = '';
    this.uiLayer.className = 'interactive';

    // Connect to server (proxied by Vite or direct in prod)
    if (!this.registry.has('socket')) {
      const serverUrl = window.location.port === '3000'
        ? `http://${window.location.hostname}:3001`
        : undefined;
      const socket = io(serverUrl);
      this.registry.set('socket', socket);
      this.socket = socket;
    } else {
      this.socket = this.registry.get('socket');
    }

    this.setupSocketListeners();
    this.renderInitialView();
  }

  private setupSocketListeners(): void {
    this.socket.off(SOCKET_EVENTS.ROOM_JOINED);
    this.socket.off(SOCKET_EVENTS.GAME_STATE_UPDATE);
    this.socket.off(SOCKET_EVENTS.ERROR_MSG);

    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, ({ roomCode, playerId }) => {
      console.log('Client received ROOM_JOINED:', roomCode, playerId);
      this.currentRoomCode = roomCode;
      this.myPlayerId = playerId || this.socket.id || '';
      this.registry.set('myPlayerId', this.myPlayerId);
      this.registry.set('roomCode', roomCode);
      SoundSynthesizer.playTaskComplete();
    });

    this.socket.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (snapshot: GameStateSnapshot) => {
      console.log('Client received GAME_STATE_UPDATE, phase:', snapshot.phase, 'code:', snapshot.roomCode, 'players:', Object.keys(snapshot.players));
      if (!this.myPlayerId && this.socket.id) {
        this.myPlayerId = this.socket.id;
        this.registry.set('myPlayerId', this.myPlayerId);
      }
      if (snapshot.phase === 'PLAYING') {
        this.uiLayer.innerHTML = '';
        this.uiLayer.className = '';
        this.scene.start('GameScene', { snapshot, myPlayerId: this.myPlayerId || this.socket.id });
      } else if (snapshot.phase === 'LOBBY') {
        this.renderInRoomView(snapshot);
      }
    });

    this.socket.on(SOCKET_EVENTS.ERROR_MSG, ({ message }) => {
      alert(message);
    });
  }

  private renderInitialView(): void {
    const savedName = localStorage.getItem('the_thaw_player_name') || `Scientist ${Math.floor(100 + Math.random() * 900)}`;

    this.uiLayer.innerHTML = `
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
        
        <!-- Icy Cracked-Glass Title Logo -->
        <div style="text-align:center; margin-bottom:28px;">
          <h1 style="
            font-size: 64px;
            font-weight: 900;
            letter-spacing: 6px;
            text-transform: uppercase;
            font-family: 'Arial Black', Impact, sans-serif;
            background: linear-gradient(180deg, #ffffff 0%, #e0f2fe 35%, #7dd3fc 70%, #0284c7 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 25px rgba(56, 189, 248, 0.7), 0 0 50px rgba(14, 165, 233, 0.4);
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.8));
            position: relative;
            display: inline-block;
          ">
            THE THAW
            <!-- Cracked-Glass Overlay Lines -->
            <span style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-image: 
                linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.7) 41%, transparent 43%),
                linear-gradient(65deg, transparent 55%, rgba(56,189,248,0.8) 56%, transparent 58%),
                linear-gradient(145deg, transparent 25%, rgba(224,242,254,0.6) 26%, transparent 28%);
              pointer-events: none;
              mix-blend-mode: overlay;
            "></span>
          </h1>
          <div style="color:#38bdf8; font-size:14px; font-weight:600; letter-spacing:3px; margin-top:2px;">
            FREEZE TAG ON A FROZEN MOON
          </div>
        </div>

        <!-- Join / Create Card -->
        <div style="width:100%; max-width:440px; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(10px); border:2px solid #38bdf8; box-shadow:0 0 30px rgba(56, 189, 248, 0.25); border-radius:14px; padding:24px; box-sizing:border-box;">
          
          <!-- Name Input -->
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#94a3b8; letter-spacing:1px; margin-bottom:6px;">RESEARCHER NAME</label>
            <input id="input-name" type="text" maxlength="16" value="${savedName}" style="width:100%; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:10px 14px; color:#f8fafc; font-size:15px; font-weight:600; outline:none; box-sizing:border-box;" />
          </div>

          <!-- Color Palette Picker -->
          <div style="margin-bottom:22px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#94a3b8; letter-spacing:1px; margin-bottom:8px;">EXPEDITION SUIT COLOR</label>
            <div id="palette-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px;">
            </div>
          </div>

          <!-- Buttons -->
          <div style="display:flex; flex-direction:column; gap:12px;">
            <button id="btn-create" style="width:100%; background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; border:none; border-radius:8px; padding:12px; font-size:15px; font-weight:bold; letter-spacing:1px; cursor:pointer; box-shadow:0 0 15px rgba(2, 132, 199, 0.5); transition:transform 0.1s ease;">
              ESTABLISH NEW EXPEDITION
            </button>

            <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
              <div style="flex:1; height:1px; background:#334155;"></div>
              <span style="color:#64748b; font-size:12px; font-weight:bold;">OR JOIN EXISTING</span>
              <div style="flex:1; height:1px; background:#334155;"></div>
            </div>

            <div style="display:flex; gap:8px;">
              <input id="input-code" type="text" maxlength="4" placeholder="ROOM CODE" style="width:140px; text-transform:uppercase; text-align:center; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:10px; color:#38bdf8; font-size:16px; font-weight:bold; font-family:monospace; outline:none; letter-spacing:2px;" />
              <button id="btn-join" style="flex:1; background:#1e293b; border:1px solid #38bdf8; color:#38bdf8; border-radius:8px; padding:10px; font-size:14px; font-weight:bold; letter-spacing:1px; cursor:pointer;">
                JOIN ROOM
              </button>
            </div>
          </div>

        </div>

      </div>
    `;

    const nameInput = this.uiLayer.querySelector('#input-name') as HTMLInputElement;
    const paletteGrid = this.uiLayer.querySelector('#palette-grid') as HTMLElement;
    const btnCreate = this.uiLayer.querySelector('#btn-create') as HTMLButtonElement;
    const btnJoin = this.uiLayer.querySelector('#btn-join') as HTMLButtonElement;
    const inputCode = this.uiLayer.querySelector('#input-code') as HTMLInputElement;

    // Render color swatches
    COLORS.forEach(c => {
      const swatch = document.createElement('div');
      swatch.dataset.key = c.key;
      swatch.style.cssText = `
        width: 100%;
        height: 36px;
        border-radius: 6px;
        background: ${c.hex};
        box-shadow: 0 0 8px ${c.hex}66;
        cursor: pointer;
        border: ${c.key === this.selectedColorKey ? '3px solid #ffffff' : '2px solid #0f172a'};
        transition: transform 0.15s ease;
      `;
      swatch.addEventListener('click', () => {
        this.selectedColorKey = c.key;
        paletteGrid.querySelectorAll('div').forEach(el => {
          (el as HTMLElement).style.border = el.dataset.key === c.key ? '3px solid #ffffff' : '2px solid #0f172a';
        });
        SoundSynthesizer.playClick();
      });
      paletteGrid.appendChild(swatch);
    });

    btnCreate.addEventListener('click', () => {
      console.log('CREATE EXPEDITION CLICKED, socket connected:', this.socket.connected, 'id:', this.socket.id);
      const name = nameInput.value.trim() || 'Scientist';
      localStorage.setItem('the_thaw_player_name', name);
      this.playerName = name;
      SoundSynthesizer.playClick();
      this.socket.emit(SOCKET_EVENTS.CREATE_ROOM, { playerName: name });
    });

    btnJoin.addEventListener('click', () => {
      const code = inputCode.value.trim().toUpperCase();
      if (!code) {
        alert('Please enter a 4-letter room code.');
        return;
      }
      const name = nameInput.value.trim() || 'Scientist';
      localStorage.setItem('the_thaw_player_name', name);
      this.playerName = name;
      SoundSynthesizer.playClick();
      this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: code, playerName: name });
    });
  }

  private renderInRoomView(snapshot: GameStateSnapshot): void {
    const me = snapshot.players[this.myPlayerId];
    const isHost = me ? me.isHost : false;
    const playersList = Object.values(snapshot.players);
    const playerCount = playersList.length;
    const canStart = playerCount >= MIN_PLAYERS && isHost;

    this.uiLayer.innerHTML = `
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
        
        <div style="width:100%; max-width:680px; background:rgba(15, 23, 42, 0.9); backdrop-filter:blur(10px); border:2px solid #38bdf8; box-shadow:0 0 35px rgba(56, 189, 248, 0.3); border-radius:14px; padding:24px; box-sizing:border-box;">
          
          <!-- Top Bar: Room Code & Status -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:14px; margin-bottom:18px;">
            <div>
              <div style="color:#94a3b8; font-size:12px; font-weight:bold; letter-spacing:1px;">EXPEDITION CODE</div>
              <div style="display:flex; align-items:center; gap:10px; margin-top:2px;">
                <span id="room-code-display" style="font-size:26px; font-family:monospace; font-weight:900; color:#38bdf8; letter-spacing:3px;">${snapshot.roomCode}</span>
                <button id="btn-copy" style="background:#1e293b; border:1px solid #38bdf8; color:#bae6fd; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:bold; cursor:pointer;">COPY</button>
              </div>
            </div>

            <div style="text-align:right;">
              <div style="color:#94a3b8; font-size:12px; font-weight:bold; letter-spacing:1px;">SCIENTISTS ASSEMBLED</div>
              <div style="font-size:20px; font-weight:bold; color:${playerCount >= MIN_PLAYERS ? '#4ade80' : '#facc15'}; margin-top:2px;">
                ${playerCount} / 10
              </div>
            </div>
          </div>

          <!-- Color Swatches (in-room) -->
          <div style="margin-bottom:16px;">
            <div style="font-size:12px; font-weight:bold; color:#94a3b8; margin-bottom:6px;">SELECT YOUR SUIT COLOR:</div>
            <div id="room-palette" style="display:flex; gap:8px;"></div>
          </div>

          <!-- Players Grid -->
          <div style="margin-bottom:20px;">
            <div style="font-size:12px; font-weight:bold; color:#94a3b8; margin-bottom:8px;">CREW MANIFEST:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; max-height:200px; overflow-y:auto; padding-right:4px;">
              ${playersList.map(p => `
                <div style="background:#1e293b; border:1px solid ${p.id === this.myPlayerId ? '#38bdf8' : '#334155'}; border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">
                  <div style="width:22px; height:22px; border-radius:50%; background:${p.colorHex}; box-shadow:0 0 8px ${p.colorHex};"></div>
                  <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:bold; color:#f8fafc;">
                    ${p.name} ${p.id === this.myPlayerId ? '(You)' : ''}
                  </div>
                  ${p.isHost ? '<span style="font-size:10px; background:#ca8a04; color:#ffffff; padding:2px 6px; border-radius:4px; font-weight:bold;">HOST</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Host Controls / Solo Testing Bots -->
          ${isHost ? `
            <div style="background:#090d16; border:1px solid #1e293b; border-radius:8px; padding:14px; margin-bottom:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:13px; color:#e2e8f0; font-weight:bold;">Frost Hunters:</span>
                <select id="select-hunters" style="background:#1e293b; color:#f8fafc; border:1px solid #334155; border-radius:6px; padding:4px 8px; font-size:13px; font-weight:bold; outline:none;">
                  <option value="1" ${snapshot.settings.hunterCount === 1 ? 'selected' : ''}>1 Hunter</option>
                  <option value="2" ${snapshot.settings.hunterCount === 2 ? 'selected' : ''}>2 Hunters</option>
                  <option value="3" ${snapshot.settings.hunterCount === 3 ? 'selected' : ''}>3 Hunters</option>
                </select>
              </div>

              <!-- Solo Bots option -->
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:13px; color:#e2e8f0; font-weight:bold;">Solo Testing AI Bots:</div>
                  <div style="font-size:11px; color:#64748b;">Add AI players that chase, flee and rescue.</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button id="btn-add-bot" style="background:#0284c7; color:#ffffff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:bold; cursor:pointer;">+ ADD BOT</button>
                  <button id="btn-remove-bot" style="background:#334155; color:#ffffff; border:none; border-radius:6px; padding:6px 10px; font-size:12px; font-weight:bold; cursor:pointer;">- REMOVE</button>
                </div>
              </div>
            </div>
          ` : `
            <div style="text-align:center; color:#94a3b8; font-size:13px; margin-bottom:18px; font-style:italic;">
              Waiting for the Expedition Leader to launch...
            </div>
          `}

          <!-- Start Game Button -->
          ${isHost ? `
            <button id="btn-start" ${!canStart ? 'disabled' : ''} style="width:100%; background:${canStart ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#334155'}; color:#ffffff; border:none; border-radius:8px; padding:14px; font-size:16px; font-weight:900; letter-spacing:1px; cursor:${canStart ? 'pointer' : 'default'}; box-shadow:${canStart ? '0 0 20px rgba(34, 197, 94, 0.5)' : 'none'};">
              ${canStart ? 'LAUNCH EXPEDITION' : `NEED AT LEAST ${MIN_PLAYERS} PLAYERS (${playerCount}/${MIN_PLAYERS})`}
            </button>
          ` : ''}

        </div>

      </div>
    `;

    // Copy room code
    const btnCopy = this.uiLayer.querySelector('#btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(snapshot.roomCode);
        btnCopy.textContent = 'COPIED!';
        setTimeout(() => { btnCopy.textContent = 'COPY'; }, 1500);
      });
    }

    // Color Swatches in Room
    const roomPalette = this.uiLayer.querySelector('#room-palette');
    if (roomPalette) {
      const takenColors = new Set(playersList.filter(p => p.id !== this.myPlayerId).map(p => p.colorKey));
      COLORS.forEach(c => {
        const isTaken = takenColors.has(c.key);
        const isSelected = me?.colorKey === c.key;
        const swatch = document.createElement('div');
        swatch.style.cssText = `
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${c.hex};
          opacity: ${isTaken ? '0.2' : '1'};
          border: ${isSelected ? '3px solid #ffffff' : '2px solid #0f172a'};
          cursor: ${isTaken ? 'not-allowed' : 'pointer'};
          box-shadow: ${isSelected ? `0 0 10px ${c.hex}` : 'none'};
        `;
        if (!isTaken) {
          swatch.addEventListener('click', () => {
            SoundSynthesizer.playClick();
            this.socket.emit(SOCKET_EVENTS.SELECT_COLOR, { colorKey: c.key });
          });
        }
        roomPalette.appendChild(swatch);
      });
    }

    // Host controls listeners
    if (isHost) {
      const selectHunters = this.uiLayer.querySelector('#select-hunters') as HTMLSelectElement;
      if (selectHunters) {
        selectHunters.addEventListener('change', () => {
          this.socket.emit(SOCKET_EVENTS.UPDATE_SETTINGS, {
            hunterCount: parseInt(selectHunters.value, 10)
          });
        });
      }

      const btnAddBot = this.uiLayer.querySelector('#btn-add-bot');
      if (btnAddBot) {
        btnAddBot.addEventListener('click', () => {
          SoundSynthesizer.playClick();
          this.socket.emit(SOCKET_EVENTS.ADD_BOT);
        });
      }

      const btnRemoveBot = this.uiLayer.querySelector('#btn-remove-bot');
      if (btnRemoveBot) {
        btnRemoveBot.addEventListener('click', () => {
          SoundSynthesizer.playClick();
          this.socket.emit(SOCKET_EVENTS.REMOVE_BOT);
        });
      }

      const btnStart = this.uiLayer.querySelector('#btn-start');
      if (btnStart && canStart) {
        btnStart.addEventListener('click', () => {
          SoundSynthesizer.playAlarm();
          this.socket.emit(SOCKET_EVENTS.START_GAME);
        });
      }
    }
  }
}
