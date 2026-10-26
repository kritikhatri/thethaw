import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = '/Users/kritikakhatri/.gemini/antigravity/brain/803e2ac2-0a74-48d6-86c5-e302d4953398';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching headless Chrome with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[PAGE LOG]:', msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]:', err));
  page.on('requestfailed', req => console.log('[REQ FAILED]:', req.url(), req.failure()));
  page.on('response', res => {
    if (res.status() >= 400) console.log('[HTTP ERROR]:', res.status(), res.url());
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Lobby Screenshot
  console.log('Capturing Lobby screenshot...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_lobby.png') });

  // 2. Establish expedition
  console.log('Establishing new expedition...');
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-create') as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForSelector('#btn-add-bot', { timeout: 8000 });
  await sleep(400);

  // Add 3 AI Bots for solo play
  console.log('Adding 3 bots...');
  await page.evaluate(() => (document.querySelector('#btn-add-bot') as HTMLElement)?.click());
  await sleep(400);
  await page.evaluate(() => (document.querySelector('#btn-add-bot') as HTMLElement)?.click());
  await sleep(400);
  await page.evaluate(() => (document.querySelector('#btn-add-bot') as HTMLElement)?.click());
  await sleep(600);

  // In-Room Manifest Screenshot
  console.log('Capturing Room Manifest screenshot...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_room_manifest.png') });

  // 3. Start Game
  console.log('Launching game...');
  await page.evaluate(() => (document.querySelector('#btn-start') as HTMLElement)?.click());
  await page.waitForSelector('#hud-progress-bar', { timeout: 8000 });
  await sleep(1500);

  // Gameplay Screenshot
  console.log('Capturing Gameplay screenshot...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_gameplay_station.png') });

  // 4. Open a Mini-Game Task Modal
  console.log('Opening Wiring mini-game...');
  await page.evaluate(() => {
    const scene = (window as any).__gameScene;
    const uiLayer = document.getElementById('ui-layer');
    if (scene && uiLayer) {
      scene.openTaskModal(uiLayer, {
        id: 'test_task_wires',
        type: 'wires',
        roomId: 'storage',
        roomName: 'Permafrost Cargo Storage',
        x: 1100,
        y: 1220,
        completed: false
      });
    }
  });
  await sleep(1000);

  console.log('Capturing Mini-Game Task screenshot...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_task_minigame.png') });

  // Close mini-game
  await page.evaluate(() => {
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) closeBtn.click();
  });
  await sleep(500);

  // 5. Trigger Emergency Meeting
  console.log('Triggering Emergency Meeting...');
  await page.evaluate(() => {
    const scene = (window as any).__gameScene;
    if (scene) {
      scene.localX = 1200;
      scene.localY = 490;
      scene.socket.emit('player_move', { x: 1200, y: 490, facing: 'down', isMoving: false });
      setTimeout(() => {
        scene.socket.emit('trigger_emergency');
      }, 300);
    }
  });
  await page.waitForSelector('#meeting-chat-messages', { timeout: 8000 });
  await sleep(1000);

  // Type a chat message in meeting
  await page.evaluate(() => {
    const input = document.getElementById('meeting-chat-input') as HTMLInputElement;
    if (input) {
      input.value = 'I was in Mess Hall. All clear on my end.';
      const form = document.getElementById('meeting-chat-form') as HTMLFormElement;
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
  await sleep(600);

  console.log('Capturing Meeting screenshot...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_meeting_discussion.png') });

  await browser.close();
  console.log('✓ All screenshots captured successfully in artifact directory!');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
