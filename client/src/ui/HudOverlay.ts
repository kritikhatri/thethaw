import { GameStateSnapshot, PlayerPublic } from '@shared/types';
import { ROOMS, MAP_WIDTH, MAP_HEIGHT } from '@shared/constants';

const PANEL = 'background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(6px); border:1px solid #334155; border-radius:12px;';

export class HudOverlay {
  private container: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private timerEl: HTMLElement;
  private rosterEl: HTMLElement;
  private roleEl: HTMLElement;
  private bannerEl: HTMLElement;
  private bannerTimeout: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = `
      <!-- Top Center: Round Timer -->
      <div style="position:absolute; top:16px; left:50%; transform:translateX(-50%); ${PANEL} padding:8px 22px; text-align:center; pointer-events:none; z-index:30;">
        <div style="font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:2px;">TIME TO SURVIVE</div>
        <div id="hud-timer" style="font-family:Orbitron, monospace; font-size:30px; font-weight:800; color:#e0f2fe;">2:00</div>
      </div>

      <!-- Top Left: Role + Roster -->
      <div style="position:absolute; top:16px; left:16px; width:240px; display:flex; flex-direction:column; gap:8px; pointer-events:none; z-index:30;">
        <div id="hud-role" style="${PANEL} padding:12px;"></div>
        <div id="hud-roster" style="${PANEL} padding:10px; display:flex; flex-direction:column; gap:5px; font-size:12px;"></div>
      </div>

      <!-- Top Right: Minimap Radar -->
      <div style="position:absolute; top:16px; right:16px; width:180px; height:135px; ${PANEL} border:2px solid #38bdf8; overflow:hidden; pointer-events:none; z-index:30; box-shadow:0 0 15px rgba(56, 189, 248, 0.2);">
        <canvas id="hud-minimap" width="180" height="135"></canvas>
      </div>

      <!-- Center Banner for big moments -->
      <div id="hud-banner" style="position:absolute; top:28%; left:50%; transform:translate(-50%, -50%) scale(0.9); opacity:0; transition:all 0.25s ease; pointer-events:none; z-index:35; font-family:Orbitron, sans-serif; font-weight:800; font-size:40px; letter-spacing:3px; text-align:center; white-space:nowrap;"></div>
    `;

    this.minimapCanvas = this.container.querySelector('#hud-minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.timerEl = this.container.querySelector('#hud-timer') as HTMLElement;
    this.rosterEl = this.container.querySelector('#hud-roster') as HTMLElement;
    this.roleEl = this.container.querySelector('#hud-role') as HTMLElement;
    this.bannerEl = this.container.querySelector('#hud-banner') as HTMLElement;
  }

  public showBanner(text: string, color: string, durationMs = 1600): void {
    this.bannerEl.textContent = text;
    this.bannerEl.style.color = color;
    this.bannerEl.style.textShadow = `0 0 24px ${color}, 0 4px 12px rgba(0,0,0,0.9)`;
    this.bannerEl.style.opacity = '1';
    this.bannerEl.style.transform = 'translate(-50%, -50%) scale(1)';
    if (this.bannerTimeout) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.bannerEl.style.opacity = '0';
      this.bannerEl.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }, durationMs);
  }

  public update(snapshot: GameStateSnapshot, myId: string, localPos: { x: number; y: number }): void {
    const me = snapshot.players[myId];
    if (!me) return;

    // Timer turns red in the final 15 seconds
    const secs = Math.ceil(snapshot.timeLeft);
    this.timerEl.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    this.timerEl.style.color = secs <= 15 ? '#f87171' : '#e0f2fe';

    // Role card
    const isHunter = me.role === 'HUNTER';
    let roleHint: string;
    if (isHunter) {
      roleHint = snapshot.hunterReleaseIn > 0
        ? `Released in ${Math.ceil(snapshot.hunterReleaseIn)}...`
        : 'Touch runners to freeze them. Freeze everyone to win!';
    } else if (me.status === 'FROZEN') {
      roleHint = 'You are frozen! Wait for a teammate to thaw you.';
    } else {
      roleHint = 'Avoid the hunters. Stand next to frozen teammates to thaw them.';
    }
    this.roleEl.style.borderColor = isHunter ? '#ef4444' : '#38bdf8';
    this.roleEl.innerHTML = `
      <div style="font-family:Orbitron, sans-serif; font-size:15px; font-weight:800; letter-spacing:1px; color:${isHunter ? '#f87171' : '#7dd3fc'};">
        ${isHunter ? 'FROST HUNTER' : 'RUNNER'}
      </div>
      <div style="font-size:12px; color:#cbd5e1; margin-top:4px; line-height:1.35;">${roleHint}</div>
    `;

    // Roster: hunters first, then runners with frozen state
    const players = Object.values(snapshot.players).filter(p => p.status !== 'DISCONNECTED');
    players.sort((a, b) => (a.role === b.role ? 0 : a.role === 'HUNTER' ? -1 : 1));
    const freeCount = players.filter(p => p.role === 'RUNNER' && p.status === 'ALIVE').length;
    const runnerCount = players.filter(p => p.role === 'RUNNER').length;
    this.rosterEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; color:#94a3b8; font-weight:700; font-size:10px; letter-spacing:1px; border-bottom:1px solid #334155; padding-bottom:4px;">
        <span>PLAYERS</span><span>${freeCount}/${runnerCount} FREE</span>
      </div>
      ${players.map(p => this.rosterRow(p, myId)).join('')}
    `;

    this.renderMinimap(snapshot, me, localPos);
  }

  private rosterRow(p: PlayerPublic, myId: string): string {
    const frozen = p.status === 'FROZEN';
    const tag = p.role === 'HUNTER'
      ? '<span style="color:#f87171;">HUNTER</span>'
      : frozen ? '<span style="color:#7dd3fc;">❄ FROZEN</span>' : '<span style="color:#4ade80;">FREE</span>';
    return `
      <div style="display:flex; align-items:center; gap:7px; opacity:${frozen ? 0.6 : 1};">
        <div style="width:10px; height:10px; border-radius:50%; background:${p.colorHex}; box-shadow:0 0 6px ${p.colorHex};"></div>
        <span style="flex:1; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:${p.id === myId ? 700 : 400};">${p.name}</span>
        <span style="font-size:10px; font-weight:700;">${tag}</span>
      </div>
    `;
  }

  private renderMinimap(snapshot: GameStateSnapshot, me: PlayerPublic, localPos: { x: number; y: number }): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / MAP_WIDTH;
    const scaleY = h / MAP_HEIGHT;

    for (const r of ROOMS) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(r.x * scaleX, r.y * scaleY, r.width * scaleX, r.height * scaleY);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x * scaleX, r.y * scaleY, r.width * scaleX, r.height * scaleY);
    }

    // Runners can see frozen teammates on radar so they know where to go
    if (me.role === 'RUNNER') {
      const pulse = 2.5 + Math.sin(performance.now() * 0.008) * 1;
      for (const p of Object.values(snapshot.players)) {
        if (p.status !== 'FROZEN' || p.id === me.id) continue;
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(p.x * scaleX, p.y * scaleY, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(localPos.x * scaleX, localPos.y * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
