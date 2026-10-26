import { SoundSynthesizer } from '../../assets/SoundSynthesizer.js';

export class DownloadTask {
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
      height: 320px;
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="color:#38bdf8; font-size:18px; letter-spacing:1px; text-transform:uppercase;">📡 Sub-Zero Telemetry Uplink</h3>
        <button id="close-btn" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:16px; margin-bottom:20px; font-family:monospace;">
        <div style="color:#94a3b8; font-size:12px; margin-bottom:6px;">FILE: <span style="color:#e0f2fe;">GLACIES_WEATHER_ARCHIVE_SEC7.DAT</span></div>
        <div style="color:#94a3b8; font-size:12px; margin-bottom:12px;">SIZE: <span style="color:#e0f2fe;">418.2 MB</span> &bull; TARGET: ORBITAL RELAY</div>
        
        <div style="width:100%; height:20px; background:#1e293b; border-radius:10px; overflow:hidden; position:relative;">
          <div id="progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #0284c7, #38bdf8); transition:width 0.2s linear;"></div>
        </div>
        <div id="percent-label" style="text-align:right; color:#38bdf8; font-size:12px; margin-top:6px;">0%</div>
      </div>

      <div style="display:flex; justify-content:center;">
        <button id="download-btn" style="background:#0284c7; color:#f8fafc; border:none; border-radius:6px; padding:12px 28px; font-size:14px; font-weight:bold; cursor:pointer; letter-spacing:1px; box-shadow:0 0 15px rgba(2, 132, 199, 0.5);">
          INITIATE DOWNLOAD
        </button>
      </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('#close-btn') as HTMLElement;
    const downloadBtn = modal.querySelector('#download-btn') as HTMLButtonElement;
    const progressBar = modal.querySelector('#progress-bar') as HTMLElement;
    const percentLabel = modal.querySelector('#percent-label') as HTMLElement;

    let downloadInterval: NodeJS.Timeout | null = null;

    closeBtn.addEventListener('click', () => {
      if (downloadInterval) clearInterval(downloadInterval);
      container.innerHTML = '';
      container.className = '';
      onClose();
    });

    downloadBtn.addEventListener('click', () => {
      SoundSynthesizer.playClick();
      downloadBtn.disabled = true;
      downloadBtn.style.opacity = '0.5';
      downloadBtn.style.cursor = 'default';
      downloadBtn.innerText = 'TRANSFERRING DATA...';

      let progress = 0;
      downloadInterval = setInterval(() => {
        progress += 4 + Math.random() * 6;
        if (progress >= 100) {
          progress = 100;
          if (downloadInterval) clearInterval(downloadInterval);
          progressBar.style.width = '100%';
          percentLabel.innerText = '100% - DOWNLOAD COMPLETE';
          percentLabel.style.color = '#4ade80';
          downloadBtn.innerText = '✓ COMPLETED';
          downloadBtn.style.background = '#15803d';
          SoundSynthesizer.playTaskComplete();

          setTimeout(() => {
            container.innerHTML = '';
            container.className = '';
            onComplete();
          }, 700);
        } else {
          progressBar.style.width = `${progress}%`;
          percentLabel.innerText = `${Math.floor(progress)}%`;
          SoundSynthesizer.playTaskStep();
        }
      }, 150);
    });
  }
}
