import { GameStateSnapshot, PlayerTask, Role } from '@shared/types';
import { ROOMS, MAP_WIDTH, MAP_HEIGHT } from '@shared/constants';

export interface HudCallbacks {
  onUse: () => void;
  onReport: () => void;
  onKill: () => void;
  onSabotage: () => void;
  onVent: () => void;
}

export class HudOverlay {
  private container: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  private useBtn: HTMLButtonElement | null = null;
  private reportBtn: HTMLButtonElement | null = null;
  private killBtn: HTMLButtonElement | null = null;
  private sabotageBtn: HTMLButtonElement | null = null;
  private ventBtn: HTMLButtonElement | null = null;
  private progressBar: HTMLElement | null = null;
  private taskListEl: HTMLElement | null = null;

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    this.container = container;
    this.container.innerHTML = `
      <!-- Top Left: Task Progress & List -->
      <div style="position:absolute; top:16px; left:16px; width:300px; display:flex; flex-direction:column; gap:8px; pointer-events:none; z-index:30;">
        <div style="background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(4px); border:1px solid #334155; border-radius:8px; padding:10px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:4px; letter-spacing:0.5px;">
            <span>STATION SYSTEM INTEGRITY</span>
            <span id="task-pct">0%</span>
          </div>
          <div style="width:100%; height:12px; background:#020617; border-radius:6px; overflow:hidden; border:1px solid #1e293b;">
            <div id="hud-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #0284c7, #22c55e); transition:width 0.3s ease;"></div>
          </div>
        </div>

        <div id="hud-task-list" style="background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(4px); border:1px solid #334155; border-radius:8px; padding:10px; font-size:12px; color:#f8fafc; display:flex; flex-direction:column; gap:6px;">
        </div>
      </div>

      <!-- Top Right: Minimap Radar -->
      <div style="position:absolute; top:16px; right:16px; width:180px; height:135px; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(4px); border:2px solid #38bdf8; border-radius:8px; overflow:hidden; pointer-events:none; z-index:30; box-shadow:0 0 15px rgba(56, 189, 248, 0.2);">
        <canvas id="hud-minimap" width="180" height="135"></canvas>
      </div>

      <!-- Bottom Right: Action Buttons -->
      <div style="position:absolute; bottom:20px; right:20px; display:flex; gap:12px; pointer-events:auto; z-index:30;">
        <button id="btn-vent" style="display:none; width:70px; height:70px; border-radius:50%; background:#0f172a; border:2px solid #38bdf8; color:#38bdf8; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 0 12px rgba(56, 189, 248, 0.4);">
          VENT
        </button>
        <button id="btn-sabotage" style="display:none; width:70px; height:70px; border-radius:50%; background:#450a0a; border:2px solid #ef4444; color:#fca5a5; font-weight:bold; font-size:11px; cursor:pointer; box-shadow:0 0 12px rgba(239, 68, 68, 0.4);">
          SABOTAGE
        </button>
        <button id="btn-kill" style="display:none; width:70px; height:70px; border-radius:50%; background:#991b1b; border:2px solid #dc2626; color:#ffffff; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 0 15px rgba(220, 38, 38, 0.6);">
          KILL
        </button>
        <button id="btn-report" style="width:70px; height:70px; border-radius:50%; background:#1e293b; border:2px solid #475569; color:#64748b; font-weight:bold; font-size:12px; cursor:pointer; opacity:0.4;">
          REPORT
        </button>
        <button id="btn-use" style="width:70px; height:70px; border-radius:50%; background:#0369a1; border:2px solid #38bdf8; color:#ffffff; font-weight:bold; font-size:14px; cursor:pointer; opacity:0.4; box-shadow:0 0 15px rgba(56, 189, 248, 0.5);">
          USE
        </button>
      </div>
    `;

    this.minimapCanvas = this.container.querySelector('#hud-minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    this.useBtn = this.container.querySelector('#btn-use') as HTMLButtonElement;
    this.reportBtn = this.container.querySelector('#btn-report') as HTMLButtonElement;
    this.killBtn = this.container.querySelector('#btn-kill') as HTMLButtonElement;
    this.sabotageBtn = this.container.querySelector('#btn-sabotage') as HTMLButtonElement;
    this.ventBtn = this.container.querySelector('#btn-vent') as HTMLButtonElement;
    this.progressBar = this.container.querySelector('#hud-progress-bar') as HTMLElement;
    this.taskListEl = this.container.querySelector('#hud-task-list') as HTMLElement;

    this.useBtn.addEventListener('click', callbacks.onUse);
    this.reportBtn.addEventListener('click', callbacks.onReport);
    this.killBtn.addEventListener('click', callbacks.onKill);
    this.sabotageBtn.addEventListener('click', callbacks.onSabotage);
    this.ventBtn.addEventListener('click', callbacks.onVent);
  }

  public update(
    snapshot: GameStateSnapshot,
    myId: string,
    myRole: Role,
    myTasks: PlayerTask[],
    canUse: boolean,
    canReport: boolean,
    canKill: boolean,
    canVent: boolean,
    inVent: boolean
  ): void {
    const me = snapshot.players[myId];
    if (!me) return;

    // Update Progress Bar
    const total = snapshot.tasksTotal || 1;
    const completed = snapshot.tasksCompleted || 0;
    const pct = Math.min(100, Math.round((completed / total) * 100));
    if (this.progressBar) {
      this.progressBar.style.width = `${pct}%`;
    }
    const pctLabel = this.container.querySelector('#task-pct');
    if (pctLabel) {
      pctLabel.textContent = `${pct}%`;
    }

    // Update Task List
    if (this.taskListEl) {
      if (myRole === 'CREW') {
        let taskHtml = `<div style="color:#38bdf8; font-weight:bold; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid #334155; padding-bottom:4px;">ASSIGNED TASKS:</div>`;
        myTasks.forEach(t => {
          taskHtml += `
            <div style="color:${t.completed ? '#4ade80' : '#e2e8f0'}; text-decoration:${t.completed ? 'line-through' : 'none'}; opacity:${t.completed ? '0.7' : '1'};">
              ${t.completed ? '✓' : '&bull;'} ${t.roomName}: ${t.type.replace('_', ' ').toUpperCase()}
            </div>
          `;
        });
        this.taskListEl.innerHTML = taskHtml;
      } else {
        this.taskListEl.innerHTML = `
          <div style="color:#ef4444; font-weight:bold; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid #7f1d1d; padding-bottom:4px;">SABOTEUR DIRECTIVE:</div>
          <div style="color:#fca5a5; line-height:1.4;">Blend in with the research team. Eliminate crew members in isolation and sabotage station life support.</div>
        `;
      }
    }

    // Update Buttons
    if (this.useBtn) {
      this.useBtn.style.opacity = canUse ? '1' : '0.4';
      this.useBtn.style.pointerEvents = canUse ? 'auto' : 'none';
    }

    if (this.reportBtn) {
      this.reportBtn.style.opacity = canReport ? '1' : '0.4';
      this.reportBtn.style.borderColor = canReport ? '#dc2626' : '#475569';
      this.reportBtn.style.color = canReport ? '#ffffff' : '#64748b';
      this.reportBtn.style.background = canReport ? '#b91c1c' : '#1e293b';
      this.reportBtn.style.pointerEvents = canReport ? 'auto' : 'none';
      if (canReport) {
        this.reportBtn.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.7)';
      } else {
        this.reportBtn.style.boxShadow = 'none';
      }
    }

    if (myRole === 'SABOTEUR') {
      if (this.killBtn) {
        this.killBtn.style.display = 'block';
        const cooldown = Math.ceil(me.killCooldown);
        if (cooldown > 0) {
          this.killBtn.textContent = `KILL (${cooldown}s)`;
          this.killBtn.style.opacity = '0.5';
          this.killBtn.style.background = '#450a0a';
          this.killBtn.style.pointerEvents = 'none';
        } else {
          this.killBtn.textContent = 'KILL';
          this.killBtn.style.opacity = canKill ? '1' : '0.6';
          this.killBtn.style.background = canKill ? '#dc2626' : '#991b1b';
          this.killBtn.style.pointerEvents = canKill ? 'auto' : 'none';
        }
      }

      if (this.sabotageBtn) {
        this.sabotageBtn.style.display = 'block';
      }

      if (this.ventBtn) {
        this.ventBtn.style.display = 'block';
        this.ventBtn.textContent = inVent ? 'EXIT' : 'VENT';
        this.ventBtn.style.opacity = canVent || inVent ? '1' : '0.4';
        this.ventBtn.style.pointerEvents = canVent || inVent ? 'auto' : 'none';
      }
    }

    // Render Minimap
    this.renderMinimap(snapshot, me);
  }

  private renderMinimap(snapshot: GameStateSnapshot, me: { x: number; y: number }): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / MAP_WIDTH;
    const scaleY = h / MAP_HEIGHT;

    // Draw rooms
    for (const r of ROOMS) {
      const rx = r.x * scaleX;
      const ry = r.y * scaleY;
      const rw = r.width * scaleX;
      const rh = r.height * scaleY;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);

      // Room label abbreviations
      ctx.fillStyle = '#94a3b8';
      ctx.font = '7px sans-serif';
      const label = r.id.replace('_', ' ').toUpperCase();
      ctx.fillText(label.slice(0, 7), rx + 2, ry + 8);
    }

    // Highlight sabotage alarm on minimap
    if (snapshot.sabotage.active === 'meltdown') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      // Pulse reactor and engine
      ctx.fillRect(250 * scaleX, 1100 * scaleY, 480 * scaleX, 460 * scaleY);
      ctx.fillRect(1680 * scaleX, 1100 * scaleY, 480 * scaleX, 460 * scaleY);
    }

    // Draw player position dot
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(me.x * scaleX, me.y * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
