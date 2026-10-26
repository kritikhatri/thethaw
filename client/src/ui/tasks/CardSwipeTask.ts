import { SoundSynthesizer } from '../../assets/SoundSynthesizer.js';

export class CardSwipeTask {
  public static open(container: HTMLElement, onComplete: () => void, onClose: () => void): void {
    container.innerHTML = '';
    container.className = 'interactive';

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 440px;
      height: 340px;
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
        <h3 style="color:#38bdf8; font-size:18px; letter-spacing:1px; text-transform:uppercase;">💳 Thermal ID Scanner</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div id="status-display" style="background:#020617; border:1px solid #1e293b; padding:10px; border-radius:6px; text-align:center; font-family:monospace; color:#38bdf8; font-size:14px; margin-bottom:20px;">
        PLEASE SWIPE CARD
      </div>

      <!-- Scanner Track -->
      <div id="swipe-track" style="position:relative; width:100%; height:80px; background:#1e293b; border:2px dashed #475569; border-radius:8px; overflow:hidden;">
        <div style="position:absolute; top:36px; left:0; width:100%; height:8px; background:#0f172a;"></div>
        
        <!-- Draggable Card -->
        <div id="swipe-card" style="position:absolute; top:10px; left:12px; width:100px; height:60px; background:linear-gradient(135deg, #0284c7, #0369a1); border:1px solid #38bdf8; border-radius:6px; cursor:grab; box-shadow:0 4px 10px rgba(0,0,0,0.5); display:flex; flex-direction:column; justify-content:space-between; padding:6px; box-sizing:border-box;">
          <div style="font-size:9px; color:#bae6fd; font-weight:bold; letter-spacing:0.5px;">STATION BOREAS</div>
          <div style="width:24px; height:16px; background:#facc15; border-radius:3px;"></div>
          <div style="font-size:8px; color:#e0f2fe; font-family:monospace;">ID: 749-SCIENTIST</div>
        </div>
      </div>

      <div style="margin-top:auto; text-align:center; color:#64748b; font-size:12px;">
        Drag card from left to right at a steady, moderate pace.
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const card = modal.querySelector('#swipe-card') as HTMLElement;
    const track = modal.querySelector('#swipe-track') as HTMLElement;
    const statusDisplay = modal.querySelector('#status-display') as HTMLElement;

    closeBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    let isDragging = false;
    let startX = 0;
    let startTime = 0;
    const initialLeft = 12;

    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      card.style.cursor = 'grabbing';
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      startX = clientX;
      startTime = Date.now();
      statusDisplay.innerText = 'READING CARD...';
      statusDisplay.style.color = '#facc15';
      SoundSynthesizer.playClick();
    };

    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const trackRect = track.getBoundingClientRect();
      const newLeft = Math.max(initialLeft, Math.min(trackRect.width - 112, clientX - trackRect.left - 50));
      card.style.left = `${newLeft}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      card.style.cursor = 'grab';

      const trackRect = track.getBoundingClientRect();
      const currentLeft = parseFloat(card.style.left || '12');
      const maxLeft = trackRect.width - 112;

      if (currentLeft >= maxLeft - 15) {
        // Reached end! Check swipe duration
        const duration = Date.now() - startTime;
        if (duration < 280) {
          statusDisplay.innerText = 'TOO FAST! BAD READ. TRY AGAIN.';
          statusDisplay.style.color = '#f87171';
          SoundSynthesizer.playKill();
        } else if (duration > 1100) {
          statusDisplay.innerText = 'TOO SLOW! TIMED OUT. TRY AGAIN.';
          statusDisplay.style.color = '#f87171';
          SoundSynthesizer.playKill();
        } else {
          statusDisplay.innerText = '✓ ACCESS GRANTED. ACCEPTED.';
          statusDisplay.style.color = '#4ade80';
          SoundSynthesizer.playTaskComplete();
          setTimeout(() => {
            container.innerHTML = '';
            container.className = '';
            onComplete();
          }, 600);
          return;
        }
      } else {
        statusDisplay.innerText = 'SWIPE INCOMPLETE. TRY AGAIN.';
        statusDisplay.style.color = '#f87171';
      }

      // Reset card position
      card.style.transition = 'left 0.25s ease-out';
      card.style.left = `${initialLeft}px`;
      setTimeout(() => {
        card.style.transition = '';
      }, 250);
    };

    card.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    card.addEventListener('touchstart', onMouseDown);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
  }
}
