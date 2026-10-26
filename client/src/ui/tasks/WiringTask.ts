import { SoundSynthesizer } from '../../assets/SoundSynthesizer.js';

export class WiringTask {
  public static open(container: HTMLElement, onComplete: () => void, onClose: () => void): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const colors = [
      { name: 'cyan', hex: '#22d3ee' },
      { name: 'amber', hex: '#fbbf24' },
      { name: 'crimson', hex: '#f87171' },
      { name: 'azure', hex: '#3b82f6' }
    ];

    const leftColors = [...colors];
    const rightColors = [...colors].sort(() => Math.random() - 0.5);
    const connected = new Map<string, string>(); // leftColor -> rightColor

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
      box-shadow: 0 0 30px rgba(56, 189, 248, 0.4), inset 0 0 20px rgba(15, 23, 42, 0.8);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      user-select: none;
    `;

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <h3 style="color:#38bdf8; font-size:18px; letter-spacing:1px; text-transform:uppercase;">⚡ Cryo Wiring Conduit</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <p style="color:#94a3b8; font-size:13px; margin-bottom:20px;">Connect matching thermal conduits from left to right.</p>
      <div style="position:relative; flex:1; display:flex; justify-content:space-between; align-items:center;">
        <canvas id="wire-canvas" width="432" height="230" style="position:absolute; top:0; left:0; pointer-events:none;"></canvas>
        <div id="left-terminals" style="display:flex; flex-direction:column; gap:24px; z-index:2;"></div>
        <div id="right-terminals" style="display:flex; flex-direction:column; gap:24px; z-index:2;"></div>
      </div>
    `;

    container.appendChild(modal);

    const canvas = modal.querySelector('#wire-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const leftContainer = modal.querySelector('#left-terminals')!;
    const rightContainer = modal.querySelector('#right-terminals')!;

    // Create left terminals
    leftColors.forEach(c => {
      const node = document.createElement('div');
      node.dataset.color = c.name;
      node.dataset.side = 'left';
      node.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${c.hex};
        box-shadow: 0 0 10px ${c.hex};
        cursor: pointer;
        border: 3px solid #0f172a;
      `;
      leftContainer.appendChild(node);
    });

    // Create right terminals
    rightColors.forEach(c => {
      const node = document.createElement('div');
      node.dataset.color = c.name;
      node.dataset.side = 'right';
      node.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${c.hex};
        box-shadow: 0 0 10px ${c.hex};
        cursor: pointer;
        border: 3px solid #0f172a;
      `;
      rightContainer.appendChild(node);
    });

    modal.querySelector('#close-btn')?.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    // Wire dragging logic
    let activeWire: { color: string; startX: number; startY: number } | null = null;
    let currentMouse = { x: 0, y: 0 };

    const redrawWires = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw completed connections
      connected.forEach((rightName, leftName) => {
        const leftEl = leftContainer.querySelector(`[data-color="${leftName}"]`) as HTMLElement;
        const rightEl = rightContainer.querySelector(`[data-color="${rightName}"]`) as HTMLElement;
        if (leftEl && rightEl) {
          const lRect = leftEl.getBoundingClientRect();
          const rRect = rightEl.getBoundingClientRect();
          const cRect = canvas.getBoundingClientRect();

          const x1 = lRect.left - cRect.left + 16;
          const y1 = lRect.top - cRect.top + 16;
          const x2 = rRect.left - cRect.left + 16;
          const y2 = rRect.top - cRect.top + 16;

          const col = colors.find(c => c.name === leftName)!.hex;
          ctx.strokeStyle = col;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(x1 + 60, y1, x2 - 60, y2, x2, y2);
          ctx.stroke();
        }
      });

      // Draw active dragging wire
      if (activeWire) {
        const col = colors.find(c => c.name === activeWire!.color)!.hex;
        ctx.strokeStyle = col;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(activeWire.startX, activeWire.startY);
        ctx.bezierCurveTo(activeWire.startX + 60, activeWire.startY, currentMouse.x - 40, currentMouse.y, currentMouse.x, currentMouse.y);
        ctx.stroke();
      }
    };

    leftContainer.querySelectorAll('div').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        const color = el.dataset.color!;
        const cRect = canvas.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        activeWire = {
          color,
          startX: elRect.left - cRect.left + 16,
          startY: elRect.top - cRect.top + 16
        };
        currentMouse = { x: e.clientX - cRect.left, y: e.clientY - cRect.top };
        SoundSynthesizer.playClick();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!activeWire) return;
      const cRect = canvas.getBoundingClientRect();
      currentMouse = { x: e.clientX - cRect.left, y: e.clientY - cRect.top };
      redrawWires();
    });

    window.addEventListener('mouseup', (e) => {
      if (!activeWire) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      if (target && target.dataset.side === 'right' && target.dataset.color === activeWire.color) {
        connected.set(activeWire.color, target.dataset.color);
        SoundSynthesizer.playTaskStep();
        if (connected.size === 4) {
          SoundSynthesizer.playTaskComplete();
          setTimeout(() => {
            container.innerHTML = '';
            container.className = '';
            onComplete();
          }, 600);
        }
      }
      activeWire = null;
      redrawWires();
    });
  }
}
