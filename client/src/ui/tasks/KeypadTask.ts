import { SoundSynthesizer } from '../../assets/SoundSynthesizer.js';

export class KeypadTask {
  public static open(container: HTMLElement, onComplete: () => void, onClose: () => void): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5);
    let nextExpected = 1;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
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
        <h3 style="color:#38bdf8; font-size:18px; letter-spacing:1px; text-transform:uppercase;">🔢 Cryo Core Calibration</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <div style="background:#020617; border:1px solid #1e293b; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="color:#94a3b8; font-size:12px; font-family:monospace;">NEXT SEQUENCE:</span>
        <span id="next-display" style="color:#38bdf8; font-size:18px; font-weight:bold; font-family:monospace;">1</span>
      </div>

      <div id="keypad-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; flex:1;"></div>

      <div style="margin-top:10px; text-align:center; color:#64748b; font-size:12px;">
        Calibrate sequence by pressing nodes 1 through 10 in ascending order.
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const grid = modal.querySelector('#keypad-grid') as HTMLElement;
    const nextDisplay = modal.querySelector('#next-display') as HTMLElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    numbers.forEach(num => {
      const btn = document.createElement('button');
      btn.dataset.num = num.toString();
      btn.innerText = num.toString();
      btn.style.cssText = `
        background: #1e293b;
        color: #f8fafc;
        border: 2px solid #334155;
        border-radius: 8px;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      btn.addEventListener('click', () => {
        if (num === nextExpected) {
          SoundSynthesizer.playTaskStep();
          btn.style.background = '#0284c7';
          btn.style.borderColor = '#38bdf8';
          btn.style.color = '#ffffff';
          btn.disabled = true;
          btn.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.6)';

          nextExpected++;
          if (nextExpected <= 10) {
            nextDisplay.innerText = nextExpected.toString();
          } else {
            nextDisplay.innerText = 'CALIBRATION SYNCHRONIZED';
            nextDisplay.style.color = '#4ade80';
            SoundSynthesizer.playTaskComplete();
            setTimeout(() => {
              container.innerHTML = '';
              container.className = '';
              onComplete();
            }, 600);
          }
        } else {
          // Wrong button clicked! Error flash & reset
          SoundSynthesizer.playKill();
          nextExpected = 1;
          nextDisplay.innerText = '1 (SEQUENCE RESET)';
          nextDisplay.style.color = '#f87171';

          // Reset all buttons
          grid.querySelectorAll('button').forEach(b => {
            b.disabled = false;
            b.style.background = '#1e293b';
            b.style.borderColor = '#334155';
            b.style.color = '#f8fafc';
            b.style.boxShadow = 'none';
          });
        }
      });

      grid.appendChild(btn);
    });
  }
}
