(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const startPanel = document.querySelector('#start-panel');
  const startBtn = document.querySelector('#start-btn');
  const soundBtn = document.querySelector('#sound-btn');
  const restartBtn = document.querySelector('#restart-btn');
  const againBtn = document.querySelector('#again-btn');
  const ending = document.querySelector('#ending');
  const message = document.querySelector('#message');
  const progressFill = document.querySelector('#progress-fill');

  const WORLD_W = 8300;
  const BASE_H = 900;
  const GRAVITY = 1780;
  const MOVE_SPEED = 270;
  const MONKEY_SPEED = MOVE_SPEED * 2 / 3;
  const JUMP_SPEED = 690;
  const DPR_LIMIT = 2;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let scale = 1;
  let started = false;
  let finished = false;
  let lastTime = performance.now();
  let elapsed = 0;
  let cameraX = 0;
  let messageTimer = 0;
  let failCooldown = 0;
  let soundEnabled = true;
  let audio = null;
  let birdTimer = 2.5;

  const input = { left: false, right: false, jump: false, jumpPressed: false };
  const player = { x: 180, y: 600, prevY: 600, vx: 0, vy: 0, radius: 19, grounded: false, facing: 1, step: 0 };
  const monkey = { x: -220, y: 625, step: 0 };

  const branches = [
    { x1: -120, x2: 650, y1: 680, y2: 560, thick: 72 },
    { x1: 650, x2: 1250, y1: 560, y2: 715, thick: 66 },
    { x1: 1250, x2: 1900, y1: 715, y2: 430, thick: 76 },
    { x1: 1900, x2: 2550, y1: 430, y2: 680, thick: 66 },
    { x1: 2550, x2: 3200, y1: 680, y2: 495, thick: 72 },
    { x1: 3200, x2: 3900, y1: 495, y2: 725, thick: 76 },
    { x1: 3900, x2: 4700, y1: 725, y2: 405, thick: 72 },
    { x1: 4700, x2: 5350, y1: 405, y2: 655, thick: 70 },
    { x1: 5350, x2: 6100, y1: 655, y2: 465, thick: 78 },
    { x1: 6100, x2: 6800, y1: 465, y2: 710, thick: 70 },
    { x1: 6800, x2: 7500, y1: 710, y2: 450, thick: 76 },
    { x1: 7500, x2: 8350, y1: 450, y2: 600, thick: 82 }
  ];

  const logs = [
    { x: 1050, center: 1050, range: 105, speed: 58, dir: 1, radius: 25, spin: 0 },
    { x: 2780, center: 2780, range: 135, speed: 70, dir: -1, radius: 28, spin: 0 },
    { x: 5070, center: 5070, range: 120, speed: 78, dir: 1, radius: 26, spin: 0 },
    { x: 7000, center: 7000, range: 145, speed: 82, dir: -1, radius: 29, spin: 0 }
  ];

  const spikes = [
    { x: 1580, period: 2.7, phase: 0.0 },
    { x: 2250, period: 3.1, phase: 1.4 },
    { x: 3520, period: 2.5, phase: 0.8 },
    { x: 4430, period: 2.9, phase: 2.0 },
    { x: 5850, period: 2.6, phase: 1.1 },
    { x: 7750, period: 2.4, phase: 0.4 }
  ];

  const leafTraps = [930, 2060, 3370, 4200, 5600, 6500, 7300].map(x => ({ x, triggered: false, timer: 0 }));
  const springs = [{ x: 1800, width: 230 }, { x: 4660, width: 270 }, { x: 6750, width: 250 }];

  const story = [
    { x: 720, text: '别回头，林间的脚步声已经醒了。' },
    { x: 1840, text: '山泉记得每一片落叶的方向。' },
    { x: 3260, text: '越过低谷，微光才会变得清晰。' },
    { x: 4900, text: '帽檐上的星光，正在替你指路。' },
    { x: 6600, text: '风越来越近，终点也越来越亮。' }
  ].map(item => ({ ...item, seen: false }));

  const fireflies = Array.from({ length: 150 }, (_, i) => ({
    x: (i * 431 + 97) % WORLD_W,
    y: 120 + ((i * 181) % 520),
    phase: (i * 1.77) % (Math.PI * 2),
    speed: 0.45 + (i % 7) * 0.07,
    size: 1.2 + (i % 4) * 0.55
  }));

  const leaves = Array.from({ length: 120 }, (_, i) => ({
    x: (i * 307 + 53) % WORLD_W,
    y: (i * 127) % 760,
    phase: i * 0.91,
    fall: 20 + (i % 8) * 4,
    drift: 12 + (i % 6) * 3,
    size: 4 + (i % 5),
    color: ['#b5c96c', '#e0bd67', '#8fb464', '#d68d5b'][i % 4]
  }));

  const streaks = Array.from({ length: 22 }, (_, i) => ({
    x: (i * 733 + 120) % WORLD_W,
    y: 120 + (i * 83) % 500,
    len: 80 + (i % 5) * 38,
    speed: 42 + (i % 7) * 11,
    phase: i * 0.4
  }));

  const motes = [];
  const bg = new Image();
  bg.src = './assets/forest-bg.png';

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    width = window.innerWidth;
    height = window.innerHeight;
    scale = height / BASE_H;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function groundAt(x) {
    for (const b of branches) {
      if (x >= b.x1 && x <= b.x2) {
        const t = (x - b.x1) / (b.x2 - b.x1);
        const base = b.y1 + (b.y2 - b.y1) * t;
        return base + Math.sin(t * Math.PI * 2) * 8;
      }
    }
    return null;
  }

  function resetGame(note = '') {
    player.x = 180;
    player.y = (groundAt(180) || 650) - player.radius;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    monkey.x = -220;
    monkey.y = (groundAt(0) || 675) - 15;
    cameraX = 0;
    finished = false;
    failCooldown = 0.9;
    ending.hidden = true;
    story.forEach(item => { item.seen = false; });
    leafTraps.forEach(item => { item.triggered = false; item.timer = 0; });
    progressFill.style.width = '0%';
    if (note) showMessage(note, 2.3); else hideMessage();
  }

  function fail(reason) {
    if (failCooldown > 0 || finished) return;
    burst(player.x, player.y, 32, '#e8c4ff');
    resetGame(reason);
    chime(false, true);
  }

  function begin() {
    if (!started) {
      started = true;
      startPanel.classList.add('is-hidden');
      setTimeout(() => { startPanel.hidden = true; }, 750);
    }
    if (soundEnabled) startAudio();
  }

  function update(dt) {
    elapsed += dt;
    updateLeaves(dt);
    updateMotes(dt);
    if (!started || finished) return;
    failCooldown = Math.max(0, failCooldown - dt);

    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetVx = direction * MOVE_SPEED;
    player.vx += (targetVx - player.vx) * Math.min(1, (player.grounded ? 10 : 4.5) * dt);
    if (direction) player.facing = direction;

    if (input.jumpPressed && player.grounded) {
      player.vy = -JUMP_SPEED;
      player.grounded = false;
      burst(player.x, player.y + player.radius, 12, '#dac1ff');
    }
    input.jumpPressed = false;

    player.prevY = player.y;
    player.vy += GRAVITY * dt;
    player.x = Math.max(20, Math.min(WORLD_W - 30, player.x + player.vx * dt));
    player.y += player.vy * dt;
    const ground = groundAt(player.x);
    if (player.grounded && ground !== null && player.vy >= 0) {
      player.y = ground - player.radius;
      player.vy = 0;
    } else if (ground !== null && player.vy >= 0 && player.prevY + player.radius <= ground + 28 && player.y + player.radius >= ground) {
      player.y = ground - player.radius;
      player.vy = 0;
      player.grounded = true;
    } else if (ground === null || player.y + player.radius < ground - 4) {
      player.grounded = false;
    }

    if (player.y > BASE_H + 120) return fail('你跌入了雾谷，旅程重新开始。');
    player.step += Math.abs(player.vx) * dt * 0.065;

    updateMonkey(dt);
    updateTraps(dt);
    checkCollisions();

    const visibleWorldW = width / scale;
    const targetCamera = Math.max(0, Math.min(WORLD_W - visibleWorldW, player.x - visibleWorldW * 0.38));
    cameraX += (targetCamera - cameraX) * Math.min(1, 3.3 * dt);

    story.forEach(item => {
      if (!item.seen && Math.abs(player.x - item.x) < 48) {
        item.seen = true;
        showMessage(item.text, 4.4);
        burst(item.x, (groundAt(item.x) || 600) - 62, 34, '#eff5a5');
        chime();
      }
    });

    messageTimer -= dt;
    if (messageTimer <= 0) hideMessage();
    progressFill.style.width = `${Math.max(0, Math.min(100, (player.x / 8080) * 100))}%`;

    if (player.x > 8050) {
      finished = true;
      ending.hidden = false;
      hideMessage();
      chime(true);
    }

    birdTimer -= dt;
    if (birdTimer <= 0) {
      birdTimer = 4 + Math.random() * 8;
      birdCall();
    }
  }

  function updateMonkey(dt) {
    monkey.x += MONKEY_SPEED * dt;
    monkey.step += MONKEY_SPEED * dt * 0.075;
    const g = groundAt(monkey.x);
    if (g !== null) monkey.y += (g - 15 - monkey.y) * Math.min(1, 12 * dt);
  }

  function updateTraps(dt) {
    logs.forEach(log => {
      log.x += log.speed * log.dir * dt;
      log.spin += log.speed * log.dir * dt / log.radius;
      if (Math.abs(log.x - log.center) > log.range) {
        log.x = log.center + Math.sign(log.x - log.center) * log.range;
        log.dir *= -1;
      }
    });
    leafTraps.forEach(trap => {
      if (trap.triggered) trap.timer += dt;
    });
  }

  function spikeAmount(spike) {
    const wave = (Math.sin(elapsed * Math.PI * 2 / spike.period + spike.phase) + 1) / 2;
    return Math.max(0, Math.min(1, (wave - 0.42) / 0.25));
  }

  function checkCollisions() {
    if (monkey.x + 23 >= player.x - player.radius) return fail('小猴子追上了你，快一点再试一次。');

    for (const log of logs) {
      const gy = (groundAt(log.x) || 650) - log.radius;
      if (Math.hypot(player.x - log.x, player.y - gy) < player.radius + log.radius - 3) {
        return fail('滚木挡住了去路，旅程重新开始。');
      }
    }

    for (const spike of spikes) {
      if (Math.abs(player.x - spike.x) < 26 && spikeAmount(spike) > 0.56 && player.grounded) {
        return fail('地刺从树枝下升起，旅程重新开始。');
      }
    }

    for (const trap of leafTraps) {
      if (!trap.triggered && Math.abs(player.x - trap.x) < 25 && player.grounded) trap.triggered = true;
      if (trap.triggered && trap.timer > 0.22 && trap.timer < 0.8 && Math.abs(player.x - trap.x) < 42) {
        return fail('落叶下藏着陷阱，旅程重新开始。');
      }
    }
  }

  function updateLeaves(dt) {
    leaves.forEach(leaf => {
      leaf.y += leaf.fall * dt;
      leaf.x += Math.sin(elapsed * 0.8 + leaf.phase) * leaf.drift * dt;
      if (leaf.y > 820) leaf.y = -20 - (leaf.phase % 80);
    });
  }

  function updateMotes(dt) {
    for (let i = motes.length - 1; i >= 0; i -= 1) {
      const p = motes[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
      if (p.life <= 0) motes.splice(i, 1);
    }
  }

  function burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 24 + Math.random() * 90;
      motes.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.8 + Math.random() * 1.6, max: 2.4, color, size: 1 + Math.random() * 3 });
    }
  }

  function showMessage(text, duration = 4.8) {
    message.textContent = text;
    if (!text) return hideMessage();
    message.classList.add('show');
    messageTimer = duration;
  }

  function hideMessage() { message.classList.remove('show'); }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(scale, scale);
    const viewW = width / scale;
    drawBackground(viewW);
    drawMountains(viewW);
    drawMist(viewW);
    drawDistantTrees(viewW);
    ctx.save();
    ctx.translate(-cameraX, 0);
    drawLightShafts();
    drawSprings();
    drawFireflies();
    drawStreaks();
    drawBranches();
    drawTraps();
    drawShrubs();
    drawLeaves();
    drawMotes();
    drawMonkey();
    drawPlayer();
    ctx.restore();
    drawVignette(viewW);
    ctx.restore();
  }

  function drawBackground(viewW) {
    const drift = cameraX * 0.065;
    if (bg.complete && bg.naturalWidth) {
      const ratio = Math.max((viewW + 180) / bg.naturalWidth, BASE_H / bg.naturalHeight);
      const dw = bg.naturalWidth * ratio;
      const dh = bg.naturalHeight * ratio;
      const span = Math.max(1, dw - viewW);
      const sx = -((drift % span) + 70);
      ctx.drawImage(bg, sx, (BASE_H - dh) * 0.5, dw, dh);
      if (sx + dw < viewW) ctx.drawImage(bg, sx + dw - 2, (BASE_H - dh) * 0.5, dw, dh);
    }
    const wash = ctx.createLinearGradient(0, 0, 0, BASE_H);
    wash.addColorStop(0, 'rgba(19,70,69,.08)');
    wash.addColorStop(0.6, 'rgba(21,74,61,.12)');
    wash.addColorStop(1, 'rgba(3,24,21,.36)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, viewW, BASE_H);
  }

  function drawMountains(viewW) {
    ctx.save();
    ctx.translate(-(cameraX * 0.11) % 1200, 0);
    for (let repeat = -1; repeat < Math.ceil(viewW / 1200) + 2; repeat++) {
      const ox = repeat * 1200;
      ctx.fillStyle = 'rgba(28,91,78,.18)';
      ctx.beginPath();
      ctx.moveTo(ox, 610);
      ctx.lineTo(ox + 180, 300);
      ctx.lineTo(ox + 340, 520);
      ctx.lineTo(ox + 570, 210);
      ctx.lineTo(ox + 820, 520);
      ctx.lineTo(ox + 1050, 270);
      ctx.lineTo(ox + 1200, 590);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMist(viewW) {
    const mist = ctx.createLinearGradient(0, 180, 0, 820);
    mist.addColorStop(0, 'rgba(188,244,211,0)');
    mist.addColorStop(0.6, 'rgba(170,228,199,.12)');
    mist.addColorStop(1, 'rgba(11,55,48,.3)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, viewW, BASE_H);
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - cameraX * 0.15 + elapsed * 6) % (viewW + 620)) - 310;
      const g = ctx.createRadialGradient(x, 620, 0, x, 620, 300);
      g.addColorStop(0, '#d9f9df');
      g.addColorStop(1, 'rgba(217,249,223,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 300, 320, 600, 600);
    }
    ctx.restore();
  }

  function drawDistantTrees(viewW) {
    ctx.save();
    ctx.translate(-(cameraX * 0.19) % 480, 0);
    ctx.fillStyle = 'rgba(7,49,42,.25)';
    for (let i = -1; i < Math.ceil(viewW / 240) + 3; i++) {
      const x = i * 240;
      const w = 48 + (i & 1) * 26;
      ctx.beginPath();
      ctx.moveTo(x - w, BASE_H);
      ctx.bezierCurveTo(x - 40, 580, x - 14, 260, x, 70);
      ctx.bezierCurveTo(x + 26, 280, x + 55, 610, x + w, BASE_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLightShafts() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let x = 450; x < WORLD_W; x += 960) {
      const g = ctx.createLinearGradient(x, 0, x + 210, 740);
      g.addColorStop(0, 'rgba(250,244,177,.13)');
      g.addColorStop(1, 'rgba(250,244,177,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 80, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 330, 760); ctx.lineTo(x + 90, 760); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawSprings() {
    springs.forEach(s => {
      const gY = groundAt(s.x) || 650;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const fall = ctx.createLinearGradient(s.x, 170, s.x, gY);
      fall.addColorStop(0, 'rgba(195,245,239,.12)');
      fall.addColorStop(0.5, 'rgba(137,225,217,.42)');
      fall.addColorStop(1, 'rgba(222,255,246,.55)');
      ctx.fillStyle = fall;
      ctx.beginPath();
      ctx.moveTo(s.x - 26, 175); ctx.quadraticCurveTo(s.x + Math.sin(elapsed * 1.5) * 12, 360, s.x - 45, gY + 10);
      ctx.lineTo(s.x + 38, gY + 10); ctx.quadraticCurveTo(s.x - Math.cos(elapsed * 1.3) * 12, 380, s.x + 28, 175); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(225,255,250,.48)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const dx = -18 + i * 7 + Math.sin(elapsed * 2.2 + i) * 5;
        ctx.beginPath(); ctx.moveTo(s.x + dx, 190); ctx.bezierCurveTo(s.x + dx + 8, 350, s.x + dx - 9, 500, s.x + dx + 4, gY); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(113,221,214,.42)';
      ctx.beginPath(); ctx.ellipse(s.x, gY + 12, s.width * .52, 18, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const ripple = ((elapsed * 55 + i * 33) % (s.width * .45));
        ctx.strokeStyle = `rgba(221,255,248,${.45 - ripple / s.width})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, gY + 12, 22 + ripple, 4 + ripple * .12, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawFireflies() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    fireflies.forEach(f => {
      const x = f.x + Math.sin(elapsed * f.speed + f.phase) * 18;
      const y = f.y + Math.cos(elapsed * f.speed * .8 + f.phase) * 13;
      const glow = .25 + .55 * (.5 + .5 * Math.sin(elapsed * 1.8 + f.phase));
      ctx.fillStyle = `rgba(238,246,151,${glow})`; ctx.shadowColor = '#effa99'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, f.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function drawStreaks() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    streaks.forEach(s => {
      const x = (s.x + elapsed * s.speed) % WORLD_W;
      const alpha = .12 + .14 * (.5 + .5 * Math.sin(elapsed + s.phase));
      const g = ctx.createLinearGradient(x, s.y, x + s.len, s.y - 18);
      g.addColorStop(0, 'rgba(215,255,190,0)'); g.addColorStop(1, `rgba(231,255,196,${alpha})`);
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, s.y); ctx.quadraticCurveTo(x + s.len * .5, s.y - 22, x + s.len, s.y - 18); ctx.stroke();
    });
    ctx.restore();
  }

  function drawBranches() {
    branches.forEach(b => {
      const dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const bark = ctx.createLinearGradient(b.x1, b.y1 - b.thick, b.x1, b.y1 + b.thick);
      bark.addColorStop(0, '#214a38'); bark.addColorStop(.22, '#123228'); bark.addColorStop(1, '#061917');
      ctx.fillStyle = bark; ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      ctx.bezierCurveTo(b.x1 + dx * .3, b.y1 + dy * .3 - 11, b.x1 + dx * .7, b.y1 + dy * .7 + 10, b.x2, b.y2);
      ctx.lineTo(b.x2 + nx * b.thick, b.y2 + ny * b.thick);
      ctx.bezierCurveTo(b.x1 + dx * .7 + nx * b.thick, b.y1 + dy * .7 + ny * b.thick + 16, b.x1 + dx * .3 + nx * b.thick, b.y1 + dy * .3 + ny * b.thick, b.x1 + nx * b.thick, b.y1 + ny * b.thick);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(124,187,116,.38)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(b.x1 + 8, b.y1 - 3); ctx.lineTo(b.x2 - 8, b.y2 - 3); ctx.stroke();
    });
  }

  function drawTraps() {
    logs.forEach(log => {
      const y = (groundAt(log.x) || 650) - log.radius;
      ctx.save(); ctx.translate(log.x, y); ctx.rotate(log.spin);
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, log.radius);
      g.addColorStop(0, '#a57945'); g.addColorStop(.55, '#694329'); g.addColorStop(1, '#35281e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, log.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(222,183,113,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, log.radius * .62, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-log.radius, 0); ctx.lineTo(log.radius, 0); ctx.stroke(); ctx.restore();
    });
    spikes.forEach(spike => {
      const amount = spikeAmount(spike), y = groundAt(spike.x) || 650;
      ctx.fillStyle = '#a9c3b1';
      for (let i = -2; i <= 2; i++) {
        const x = spike.x + i * 11, h = (26 + Math.abs(i) * 4) * amount;
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
      }
    });
    leafTraps.forEach(trap => {
      const y = groundAt(trap.x) || 650;
      const sink = trap.triggered ? Math.min(15, trap.timer * 28) : 0;
      ctx.save(); ctx.translate(0, sink);
      ['#c0a55e', '#8aa85f', '#d27d50', '#769454'].forEach((color, i) => {
        ctx.fillStyle = color;
        for (let j = 0; j < 5; j++) {
          const a = i * 1.3 + j * 1.7; ctx.beginPath(); ctx.ellipse(trap.x + Math.sin(a) * (10 + i * 5), y - 5 - Math.cos(a) * 8, 10, 4, a, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.restore();
    });
  }

  function drawShrubs() {
    ctx.save(); ctx.fillStyle = 'rgba(6,31,27,.7)';
    for (let i = 0; i < 94; i++) {
      const x = i * 92 + 10, y = 775 + Math.sin(i * 1.9) * 36;
      ctx.beginPath(); ctx.ellipse(x, y, 76 + (i % 3) * 18, 52, -.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawLeaves() {
    ctx.save();
    leaves.forEach(leaf => {
      const x = leaf.x, y = leaf.y;
      ctx.fillStyle = leaf.color; ctx.globalAlpha = .45 + .3 * Math.sin(elapsed + leaf.phase);
      ctx.save(); ctx.translate(x, y); ctx.rotate(elapsed * .5 + leaf.phase); ctx.beginPath(); ctx.ellipse(0, 0, leaf.size, leaf.size * .42, .4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    ctx.restore();
  }

  function drawMotes() {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    motes.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  function drawPlayer() {
    const walk = player.grounded && Math.abs(player.vx) > 8 ? Math.sin(player.step) : 0;
    const bob = player.grounded ? Math.abs(walk) * 2 : 0;
    ctx.save(); ctx.translate(player.x, player.y - bob); ctx.scale(player.facing, 1);
    ctx.globalCompositeOperation = 'screen';
    const aura = ctx.createRadialGradient(0, -12, 1, 0, -12, 50); aura.addColorStop(0, 'rgba(211,174,255,.32)'); aura.addColorStop(1, 'rgba(211,174,255,0)'); ctx.fillStyle = aura; ctx.fillRect(-52, -68, 104, 112);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#342845'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, 15); ctx.lineTo(-8 + walk * 5, 29); ctx.moveTo(6, 15); ctx.lineTo(8 - walk * 5, 29); ctx.stroke();
    const dress = ctx.createLinearGradient(0, -12, 0, 25); dress.addColorStop(0, '#f4efe4'); dress.addColorStop(1, '#b9c8bf'); ctx.fillStyle = dress;
    ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(-20, 24); ctx.quadraticCurveTo(0, 32, 20, 24); ctx.lineTo(9, -13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#debda5'; ctx.beginPath(); ctx.arc(0, -23, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6f3f91'; ctx.beginPath(); ctx.moveTo(-15, -27); ctx.lineTo(1, -58); ctx.lineTo(13, -26); ctx.quadraticCurveTo(0, -19, -15, -27); ctx.fill();
    ctx.fillStyle = '#9f68c8'; ctx.fillRect(-17, -28, 32, 4);
    ctx.strokeStyle = '#8b5db3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(25, -4 + walk * 2, 32, 4 + walk * 3); ctx.stroke();
    ctx.fillStyle = '#f5e89f'; ctx.shadowColor = '#f5e89f'; ctx.shadowBlur = 13; ctx.beginPath(); ctx.arc(13, 2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawMonkey() {
    const y = monkey.y, swing = Math.sin(monkey.step) * 5;
    ctx.save(); ctx.translate(monkey.x, y);
    ctx.strokeStyle = '#513522'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, 8); ctx.lineTo(-10 + swing, 23); ctx.moveTo(7, 8); ctx.lineTo(10 - swing, 23); ctx.moveTo(-8, -1); ctx.lineTo(-17 - swing, 10); ctx.moveTo(8, -1); ctx.lineTo(17 + swing, 9); ctx.stroke();
    ctx.fillStyle = '#68442b'; ctx.beginPath(); ctx.ellipse(0, 1, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7b5132'; ctx.beginPath(); ctx.arc(0, -16, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d3a36f'; ctx.beginPath(); ctx.ellipse(0, -14, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#68442b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-10, 2, 20, Math.PI * .25, Math.PI * 1.35); ctx.stroke(); ctx.restore();
  }

  function drawVignette(viewW) {
    const g = ctx.createRadialGradient(viewW * .5, BASE_H * .45, BASE_H * .1, viewW * .5, BASE_H * .45, Math.max(viewW, BASE_H) * .68);
    g.addColorStop(0, 'rgba(1,12,11,0)'); g.addColorStop(.7, 'rgba(1,12,11,.08)'); g.addColorStop(1, 'rgba(1,12,11,.65)'); ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, BASE_H);
  }

  function frame(now) {
    const dt = Math.min(.033, (now - lastTime) / 1000 || 0); lastTime = now; update(dt); render(); requestAnimationFrame(frame);
  }

  function startAudio() {
    if (audio) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); audio.master.gain.setTargetAtTime(.13, audio.ctx.currentTime, .2); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
    const ac = new AudioContext(), master = ac.createGain(); master.gain.value = .13; master.connect(ac.destination);
    const buffer = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), data = buffer.getChannelData(0); let last = 0;
    for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; last = last * .985 + white * .015; data[i] = last * 1.8; }
    const wind = ac.createBufferSource(), filter = ac.createBiquadFilter(), windGain = ac.createGain(); wind.buffer = buffer; wind.loop = true; filter.type = 'lowpass'; filter.frequency.value = 760; windGain.gain.value = .72; wind.connect(filter).connect(windGain).connect(master); wind.start();
    const padGain = ac.createGain(); padGain.gain.value = .06; padGain.connect(master);
    [174.61, 261.63].forEach((frequency, i) => { const osc = ac.createOscillator(), gain = ac.createGain(); osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.value = i ? .3 : .42; osc.connect(gain).connect(padGain); osc.start(); });
    audio = { ctx: ac, master };
  }

  function chime(final = false, low = false) {
    if (!audio || !soundEnabled) return;
    const t = audio.ctx.currentTime, notes = low ? [196, 174.61] : final ? [523.25, 659.25, 783.99] : [392, 523.25];
    notes.forEach((frequency, index) => { const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain(); osc.type = low ? 'triangle' : 'sine'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.001, t + index * .12); gain.gain.exponentialRampToValueAtTime(.1, t + index * .12 + .02); gain.gain.exponentialRampToValueAtTime(.001, t + index * .12 + .9); osc.connect(gain).connect(audio.master); osc.start(t + index * .12); osc.stop(t + index * .12 + 1); });
  }

  function birdCall() {
    if (!audio || !soundEnabled || !started) return;
    const t = audio.ctx.currentTime;
    for (let i = 0; i < 3; i++) { const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain(); osc.frequency.setValueAtTime(1150 + i * 140, t + i * .09); osc.frequency.exponentialRampToValueAtTime(1650 + i * 120, t + i * .09 + .07); gain.gain.setValueAtTime(.001, t + i * .09); gain.gain.exponentialRampToValueAtTime(.045, t + i * .09 + .018); gain.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .12); osc.connect(gain).connect(audio.master); osc.start(t + i * .09); osc.stop(t + i * .09 + .13); }
  }

  function bindHold(button, key) {
    const down = e => { e.preventDefault(); begin(); input[key] = true; }, up = e => { e.preventDefault(); input[key] = false; };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
  }

  window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'A', 'd', 'D', 'w', 'W'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') input.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') input.right = true;
    if (event.key === 'ArrowUp' || event.key === ' ' || event.key.toLowerCase() === 'w') { if (!input.jump) input.jumpPressed = true; input.jump = true; }
    if (!started) begin();
  });
  window.addEventListener('keyup', event => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') input.left = false; if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') input.right = false; if (event.key === 'ArrowUp' || event.key === ' ' || event.key.toLowerCase() === 'w') input.jump = false; });
  startBtn.addEventListener('click', begin);
  restartBtn.addEventListener('click', () => { resetGame(); begin(); });
  againBtn.addEventListener('click', () => { resetGame(); begin(); });
  soundBtn.addEventListener('click', () => { soundEnabled = !soundEnabled; soundBtn.textContent = `声音：${soundEnabled ? '开' : '关'}`; if (soundEnabled) startAudio(); else if (audio) audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, .16); });
  bindHold(document.querySelector('#left-btn'), 'left'); bindHold(document.querySelector('#right-btn'), 'right');
  const jumpBtn = document.querySelector('#jump-btn'); jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); begin(); if (!input.jump) input.jumpPressed = true; input.jump = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => jumpBtn.addEventListener(type, e => { e.preventDefault(); input.jump = false; }));
  window.addEventListener('resize', resize); document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
  resize(); resetGame(); requestAnimationFrame(frame);
})();
