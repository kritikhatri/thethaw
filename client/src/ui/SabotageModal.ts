import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';

export class SabotageModal {
  public static open(
    container: HTMLElement,
    cooldownSec: number,
    isSabotageActive: boolean,
    onTrigger: (type: 'meltdown' | 'blackout') => void,
    onClose: () => void
  ): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      background: #0f172a;
      border: 2px solid #ef4444;
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.4);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      user-select: none;
    `;

    const canSabotage = cooldownSec <= 0 && !isSabotageActive;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="color:#ef4444; font-size:18px; letter-spacing:1px; text-transform:uppercase;">⚠️ Station Sabotage Uplink</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <p style="color:#94a3b8; font-size:13px; margin-bottom:20px;">
        Trigger catastrophic station anomalies to disorient the crew and force critical repairs.
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <!-- Meltdown Card -->
        <div style="background:#1e293b; border:1px solid #dc2626; border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <h4 style="color:#f87171; font-size:15px; margin-bottom:6px;">💥 Reactor Meltdown</h4>
            <p style="color:#94a3b8; font-size:12px; margin-bottom:12px;">Initiates a 45s countdown. Requires dual-station stabilization or the outpost is destroyed.</p>
          </div>
          <button id="btn-meltdown" ${!canSabotage ? 'disabled' : ''} style="background:${canSabotage ? '#dc2626' : '#450a0a'}; color:#f8fafc; border:none; border-radius:6px; padding:10px; font-weight:bold; cursor:${canSabotage ? 'pointer' : 'default'};">
            ${cooldownSec > 0 ? `COOLDOWN (${Math.ceil(cooldownSec)}s)` : 'TRIGGER MELTDOWN'}
          </button>
        </div>

        <!-- Blackout Card -->
        <div style="background:#1e293b; border:1px solid #3b82f6; border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <h4 style="color:#60a5fa; font-size:15px; margin-bottom:6px;">🌑 Sub-zero Blackout</h4>
            <p style="color:#94a3b8; font-size:12px; margin-bottom:12px;">Cuts station lighting. Drops crew vision to a narrow cone while saboteurs retain night vision.</p>
          </div>
          <button id="btn-blackout" ${!canSabotage ? 'disabled' : ''} style="background:${canSabotage ? '#2563eb' : '#172554'}; color:#f8fafc; border:none; border-radius:6px; padding:10px; font-weight:bold; cursor:${canSabotage ? 'pointer' : 'default'};">
            ${cooldownSec > 0 ? `COOLDOWN (${Math.ceil(cooldownSec)}s)` : 'CUT POWER GRID'}
          </button>
        </div>
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const btnMeltdown = modal.querySelector('#btn-meltdown') as HTMLButtonElement;
    const btnBlackout = modal.querySelector('#btn-blackout') as HTMLButtonElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    if (canSabotage) {
      btnMeltdown.addEventListener('click', () => {
        SoundSynthesizer.playAlarm();
        onTrigger('meltdown');
        container.innerHTML = '';
        container.className = '';
      });

      btnBlackout.addEventListener('click', () => {
        SoundSynthesizer.playKill();
        onTrigger('blackout');
        container.innerHTML = '';
        container.className = '';
      });
    }
  }

  /**
   * Meltdown Stabilizer Panel modal (Reactor or Life Support)
   */
  public static openMeltdownFixModal(
    container: HTMLElement,
    locationLabel: string,
    onActivate: () => void,
    onClose: () => void
  ): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
      background: #0f172a;
      border: 2px solid #ef4444;
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.4);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      user-select: none;
    `;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#ef4444; font-size:16px; letter-spacing:1px; text-transform:uppercase;">🚨 ${locationLabel}</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <p style="color:#fca5a5; font-size:13px; margin-bottom:20px;">
        CRITICAL MELTDOWN IN PROGRESS! Press the thermal stabilizer pad to secure this node. (Both Reactor and Life Support must be active simultaneously).
      </p>

      <div style="display:flex; justify-content:center; margin-bottom:16px;">
        <button id="stabilize-btn" style="width:140px; height:140px; border-radius:50%; background:linear-gradient(135deg, #dc2626, #991b1b); border:4px solid #f87171; color:#ffffff; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 0 25px rgba(239, 68, 68, 0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
          <span>✋</span>
          <span>STABILIZE</span>
        </button>
      </div>
      <div id="status-label" style="text-align:center; color:#94a3b8; font-size:12px; font-family:monospace;">READY FOR STABILIZATION</div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const stabilizeBtn = modal.querySelector('#stabilize-btn') as HTMLButtonElement;
    const statusLabel = modal.querySelector('#status-label') as HTMLElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    stabilizeBtn.addEventListener('click', () => {
      SoundSynthesizer.playTaskComplete();
      stabilizeBtn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
      stabilizeBtn.style.borderColor = '#4ade80';
      stabilizeBtn.style.boxShadow = '0 0 25px rgba(74, 222, 128, 0.6)';
      stabilizeBtn.innerHTML = '<span>✓</span><span>STABILIZED</span>';
      statusLabel.innerText = 'NODE LOCKED & STABILIZED';
      statusLabel.style.color = '#4ade80';
      onActivate();
      setTimeout(() => {
        container.innerHTML = '';
        container.className = '';
      }, 700);
    });
  }

  /**
   * Electrical Breakers panel modal (Blackout fix)
   */
  public static openBlackoutFixModal(
    container: HTMLElement,
    currentSwitches: boolean[],
    onFlip: (index: number) => void,
    onClose: () => void
  ): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 440px;
      background: #0f172a;
      border: 2px solid #38bdf8;
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.4);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      user-select: none;
    `;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#38bdf8; font-size:16px; letter-spacing:1px; text-transform:uppercase;">⚡ Main Breaker Switchboard</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <p style="color:#94a3b8; font-size:13px; margin-bottom:20px;">
        Flip all circuit breakers UP to restore power to station luminaires.
      </p>

      <div id="switches-container" style="display:flex; justify-content:space-around; align-items:center; background:#020617; border:1px solid #1e293b; border-radius:8px; padding:20px;">
      </div>

      <div id="status-footer" style="margin-top:16px; text-align:center; color:#94a3b8; font-size:12px; font-family:monospace;">
        CIRCUITS COMPROMISED
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const switchesContainer = modal.querySelector('#switches-container') as HTMLElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    currentSwitches.forEach((isOn, index) => {
      const sw = document.createElement('button');
      sw.style.cssText = `
        width: 48px;
        height: 90px;
        background: #1e293b;
        border: 2px solid ${isOn ? '#4ade80' : '#ef4444'};
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: ${isOn ? 'flex-start' : 'flex-end'};
        align-items: center;
        padding: 4px;
        box-shadow: 0 0 10px ${isOn ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
      `;

      const lever = document.createElement('div');
      lever.style.cssText = `
        width: 36px;
        height: 38px;
        background: ${isOn ? '#22c55e' : '#dc2626'};
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
      `;
      sw.appendChild(lever);

      sw.addEventListener('click', () => {
        SoundSynthesizer.playClick();
        onFlip(index);
      });

      switchesContainer.appendChild(sw);
    });
  }
}
