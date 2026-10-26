import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { GameStateSnapshot } from '@shared/types';
import { SOCKET_EVENTS } from '@shared/constants';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';

export class EndScene extends Phaser.Scene {
  private socket!: Socket;
  private myPlayerId!: string;
  private snapshot!: GameStateSnapshot;
  private uiLayer!: HTMLElement;

  constructor() {
    super({ key: 'EndScene' });
  }

  init(data: { snapshot: GameStateSnapshot; myPlayerId: string }): void {
    this.snapshot = data.snapshot;
    this.myPlayerId = data.myPlayerId;
  }

  create(): void {
    this.socket = this.registry.get('socket');
    this.uiLayer = document.getElementById('ui-layer')!;
    this.uiLayer.innerHTML = '';
    this.uiLayer.className = 'interactive';

    const winner = this.snapshot.winner || 'CREW';
    const isCrewWin = winner === 'CREW';
    const reason = this.snapshot.winReason || 'Expedition concluded.';
    const me = this.snapshot.players[this.myPlayerId];
    const isHost = me ? me.isHost : false;

    // Play victory or defeat sound
    if (isCrewWin) {
      SoundSynthesizer.playVictory();
    } else {
      SoundSynthesizer.playDefeat();
    }

    const titleColor = isCrewWin ? '#38bdf8' : '#ef4444';
    const bannerTitle = isCrewWin ? 'CREW VICTORY' : 'SABOTEUR VICTORY';

    this.uiLayer.innerHTML = `
      <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; user-select:none;">
        
        <div style="width:100%; max-width:640px; background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(10px); border:2px solid ${titleColor}; box-shadow:0 0 40px ${titleColor}44; border-radius:14px; padding:32px; box-sizing:border-box; text-align:center;">
          
          <h1 style="font-size:44px; font-weight:900; letter-spacing:4px; color:${titleColor}; margin-bottom:12px; font-family:'Arial Black', Impact, sans-serif; text-shadow:0 0 20px ${titleColor};">
            ${bannerTitle}
          </h1>

          <div style="color:#e2e8f0; font-size:16px; margin-bottom:28px; line-height:1.5;">
            ${reason}
          </div>

          <!-- Role Reveals -->
          <div style="text-align:left; margin-bottom:28px;">
            <div style="font-size:12px; font-weight:bold; color:#94a3b8; letter-spacing:1px; margin-bottom:10px;">EXPEDITION PERSONNEL ROLES REVEALED:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px; max-height:220px; overflow-y:auto; padding-right:4px;">
              ${Object.values(this.snapshot.players).map(p => {
                const isSab = p.role === 'SABOTEUR';
                return `
                  <div style="background:#1e293b; border:1px solid ${isSab ? '#ef4444' : '#38bdf8'}; border-radius:8px; padding:10px; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div style="width:20px; height:20px; border-radius:50%; background:${p.colorHex}; box-shadow:0 0 6px ${p.colorHex};"></div>
                      <span style="font-size:13px; font-weight:bold; color:#f8fafc;">${p.name}</span>
                    </div>
                    <span style="font-size:11px; font-weight:bold; color:${isSab ? '#f87171' : '#4ade80'}; font-family:monospace; background:${isSab ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.2)'}; padding:2px 6px; border-radius:4px;">
                      ${p.role || 'CREW'}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Return to lobby -->
          ${isHost ? `
            <button id="btn-return-lobby" style="background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; border:none; border-radius:8px; padding:14px 32px; font-size:16px; font-weight:bold; letter-spacing:1px; cursor:pointer; box-shadow:0 0 20px rgba(2, 132, 199, 0.5);">
              RETURN TO EXPEDITION LOBBY
            </button>
          ` : `
            <div style="color:#94a3b8; font-size:14px; font-style:italic;">
              Waiting for expedition leader to return to lobby...
            </div>
          `}

        </div>

      </div>
    `;

    const returnBtn = this.uiLayer.querySelector('#btn-return-lobby');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => {
        SoundSynthesizer.playClick();
        this.socket.emit(SOCKET_EVENTS.RETURN_TO_LOBBY);
      });
    }

    this.socket.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (snapshot: GameStateSnapshot) => {
      if (snapshot.phase === 'LOBBY') {
        this.uiLayer.innerHTML = '';
        this.uiLayer.className = '';
        this.scene.start('LobbyScene');
      }
    });
  }
}
