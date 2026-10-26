import { SoundSynthesizer } from '../../assets/SoundSynthesizer.js';

export class LeversTask {
  public static open(container: HTMLElement, onComplete: () => void, onClose: () => void): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const levers = [
      { id: 1, label: 'Primary Cryo Valve', targetMin: 65, targetMax: 85, currentVal: 15 },
      { id: 2, label: 'Secondary Heat Exchanger', targetMin: 25, targetMax: 45, currentVal: 85 },
      { id: 3, label: 'Thermal Bypass Flow', targetMin: 50, targetMax: 70, currentVal: 20 }
    ];

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      height: 380px;
      background: #0f172a;
      border: 2px solid #38bdf8;
      box-shadow: 0 0 30px rgba(56, 189, 248, 0.4);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      user-select: none;
    `;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#38bdf8; font-size:18px; letter-spacing:1px; text-transform:uppercase;">🎛️ Coolant Pressure Alignment</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <p style="color:#94a3b8; font-size:13px; margin-bottom:16px;">Slide all 3 pressure regulators into their green target zones.</p>

      <div id="levers-container" style="display:flex; justify-content:space-around; align-items:center; flex:1; background:#020617; border:1px solid #1e293b; border-radius:8px; padding:16px;">
      </div>

      <div id="status-footer" style="margin-top:12px; text-align:center; color:#64748b; font-size:12px;">
        Aligning coolant manifold pressure...
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const leversContainer = modal.querySelector('#levers-container') as HTMLElement;
    const statusFooter = modal.querySelector('#status-footer') as HTMLElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    const checkAllAligned = () => {
      const allOk = levers.every(l => l.currentVal >= l.targetMin && l.currentVal <= l.targetMax);
      if (allOk) {
        statusFooter.innerText = '✓ PRESSURE STABILIZED & LOCKED';
        statusFooter.style.color = '#4ade80';
        SoundSynthesizer.playTaskComplete();
        setTimeout(() => {
          container.innerHTML = '';
          container.className = '';
          onComplete();
        }, 600);
      }
    };

    levers.forEach(l => {
      const col = document.createElement('div');
      col.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      `;

      // Status LED indicator
      const led = document.createElement('div');
      led.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #dc2626;
        box-shadow: 0 0 8px #dc2626;
        transition: all 0.2s ease;
      `;

      // Track Container
      const track = document.createElement('div');
      track.style.cssText = `
        position: relative;
        width: 44px;
        height: 160px;
        background: #1e293b;
        border: 2px solid #334155;
        border-radius: 6px;
      `;

      // Green Target Zone Highlight
      const targetZone = document.createElement('div');
      const targetHeight = (l.targetMax - l.targetMin) * 1.6;
      const targetBottom = l.targetMin * 1.6;
      targetZone.style.cssText = `
        position: absolute;
        left: 0;
        width: 100%;
        bottom: ${targetBottom}px;
        height: ${targetHeight}px;
        background: rgba(74, 222, 128, 0.25);
        border-top: 1px dashed #4ade80;
        border-bottom: 1px dashed #4ade80;
      `;
      track.appendChild(targetZone);

      // Slider Handle
      const handle = document.createElement('div');
      handle.style.cssText = `
        position: absolute;
        left: 2px;
        width: 36px;
        height: 22px;
        bottom: ${l.currentVal * 1.6 - 11}px;
        background: #0284c7;
        border: 1px solid #38bdf8;
        border-radius: 4px;
        cursor: grab;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      `;
      track.appendChild(handle);

      let isDragging = false;

      const updateSlider = (val: number) => {
        l.currentVal = Math.max(0, Math.min(100, Math.round(val)));
        handle.style.bottom = `${l.currentVal * 1.6 - 11}px`;

        if (l.currentVal >= l.targetMin && l.currentVal <= l.targetMax) {
          led.style.background = '#4ade80';
          led.style.boxShadow = '0 0 10px #4ade80';
          handle.style.background = '#15803d';
        } else {
          led.style.background = '#dc2626';
          led.style.boxShadow = '0 0 8px #dc2626';
          handle.style.background = '#0284c7';
        }
      };

      updateSlider(l.currentVal);

      const onStart = () => {
        isDragging = true;
        handle.style.cursor = 'grabbing';
        SoundSynthesizer.playClick();
      };

      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const rect = track.getBoundingClientRect();
        const relativeY = rect.bottom - clientY;
        const pct = (relativeY / rect.height) * 100;
        updateSlider(pct);
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        handle.style.cursor = 'grab';
        SoundSynthesizer.playTaskStep();
        checkAllAligned();
      };

      handle.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      handle.addEventListener('touchstart', onStart);
      window.addEventListener('touchmove', onMove);
      window.addEventListener('touchend', onEnd);

      const label = document.createElement('div');
      label.innerText = `L-${l.id}`;
      label.style.cssText = 'color:#94a3b8; font-size:12px; font-weight:bold; font-family:monospace;';

      col.appendChild(led);
      col.appendChild(track);
      col.appendChild(label);
      leversContainer.appendChild(col);
    });
  }
}
