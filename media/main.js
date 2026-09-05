// @ts-check
(function () {
  const vscode = acquireVsCodeApi();

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('jet-canvas');
  const ctx = canvas.getContext('2d');

  const prevState = vscode.getState() || {};

  const AIRCRAFT_TYPES = ['f16', 'f22', 'f18', 'su57', 'su30', 'su25'];

  let selectedAircraft = AIRCRAFT_TYPES.includes(prevState.selectedAircraft) ? prevState.selectedAircraft : 'f16';
  let isDark = typeof prevState.isDark === 'boolean' ? prevState.isDark : true;

  const MAX_JETS = 6;

  // pixel-art sprites: drawn nose-up in the source image, rotated +90deg at
  // render time to align with the nose-right convention used everywhere else
  const SPRITE_LENGTH = { f16: 78, f22: 92, f18: 85, su57: 94, su30: 96, su25: 80 };
  const SPRITES = {};
  const spriteUris = /** @type {any} */ (window).__SPRITES__ || {};
  for (const type of Object.keys(spriteUris)) {
    const img = new Image();
    img.src = spriteUris[type];
    SPRITES[type] = img;
  }

  let width = 0;
  let height = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  let nextId = 1;

  function createJet(overrides) {
    const now = performance.now();
    return Object.assign(
      {
        id: nextId++,
        aircraft: selectedAircraft,
        x: randRange(60, 160),
        y: randRange(40, Math.max(60, height - 40)),
        baseSpeed: randRange(1.2, 1.6),
        speed: 1.4,
        dir: Math.random() < 0.5 ? -1 : 1,
        angle: 0,
        bank: 0,
        state: 'cruise',
        stateTime: 0,
        boostUntil: 0,
        nextTrick: now + randRange(4000, 9000),
        trail: []
      },
      overrides
    );
  }

  /** @type {any[]} */
  let jets = [];
  if (Array.isArray(prevState.jets)) {
    jets = prevState.jets.map((s) =>
      createJet({
        x: s.x,
        y: s.y,
        dir: s.dir,
        aircraft: AIRCRAFT_TYPES.includes(s.aircraft) ? s.aircraft : selectedAircraft
      })
    );
  } else {
    jets = [createJet({ x: 60, y: height ? height / 2 : 60 })];
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'reset':
        jets = [createJet({ x: 60, y: height / 2 })];
        saveState();
        break;
      case 'addJet':
        if (jets.length < MAX_JETS) {
          const aircraft = AIRCRAFT_TYPES.includes(msg.aircraft) ? msg.aircraft : selectedAircraft;
          selectedAircraft = aircraft;
          jets.push(createJet({ aircraft }));
          saveState();
        }
        break;
      case 'removeJet':
        if (jets.length > 0) {
          jets.pop();
          saveState();
        }
        break;
      case 'boost':
        jets.forEach(triggerBoost);
        break;
      case 'theme':
        // ColorThemeKind: 1 = Light, 2 = Dark, 3 = HighContrast, 4 = HighContrastLight
        // only auto-follow the editor theme until the user manually picks a sky
        if (typeof prevState.isDark !== 'boolean') {
          isDark = msg.kind !== 1 && msg.kind !== 4;
        }
        break;
      case 'toggleSky':
        isDark = !isDark;
        saveState();
        break;
    }
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let hit = null;
    let hitDist = Infinity;
    for (const j of jets) {
      const dx = cx - j.x;
      const dy = cy - j.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 56 && dist < hitDist) {
        hit = j;
        hitDist = dist;
      }
    }

    if (hit) {
      triggerBoost(hit);
    } else if (jets.length > 0) {
      triggerLoop(jets[Math.floor(Math.random() * jets.length)]);
    }
  });

  function triggerBoost(j) {
    j.boostUntil = performance.now() + 1600;
    if (j.state === 'cruise') {
      j.state = 'boost';
      j.stateTime = 0;
    }
  }

  function triggerLoop(j) {
    if (j.state === 'cruise' || j.state === 'boost') {
      j.state = 'loop';
      j.stateTime = 0;
    }
  }

  function saveState() {
    vscode.setState({
      jets: jets.map((j) => ({ x: j.x, y: j.y, dir: j.dir, aircraft: j.aircraft })),
      selectedAircraft,
      isDark
    });
  }

  // ---- Drawing helpers ----
  function skyGradient() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    if (isDark) {
      g.addColorStop(0, '#0b1a2b');
      g.addColorStop(1, '#132b45');
    } else {
      g.addColorStop(0, '#bfe3ff');
      g.addColorStop(1, '#e8f6ff');
    }
    return g;
  }

  let clouds = null;
  function ensureClouds() {
    if (clouds && clouds.length) return;
    clouds = Array.from({ length: 4 }, () => ({
      x: Math.random() * 400,
      y: Math.random() * 200,
      scale: randRange(0.5, 1.2),
      speed: randRange(0.05, 0.15)
    }));
  }

  function drawClouds(dt) {
    ensureClouds();
    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
    for (const c of clouds) {
      c.x -= c.speed * dt;
      if (c.x < -60) c.x = width + 60;
      drawCloudPuff(c.x, c.y % Math.max(height, 1), c.scale);
    }
    ctx.restore();
  }

  function drawCloudPuff(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 16 * s, y + 3 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 16 * s, y + 4 * s, 14 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawContrail(j) {
    if (j.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < j.trail.length; i++) {
      const p0 = j.trail[i - 1];
      const p1 = j.trail[i];
      const alpha = (i / j.trail.length) * 0.35;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = p1.boost ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function nozzleX(type) {
    return -(SPRITE_LENGTH[type] / 2) * 0.95;
  }

  // engine nozzle positions (local space) per aircraft, used for exhaust flames
  const NOZZLES = {
    f16: [{ x: nozzleX('f16'), y: 0, spread: 4 }],
    f22: [
      { x: nozzleX('f22'), y: -4, spread: 2.6 },
      { x: nozzleX('f22'), y: 4, spread: 2.6 }
    ],
    f18: [
      { x: nozzleX('f18'), y: -3.5, spread: 2.8 },
      { x: nozzleX('f18'), y: 3.5, spread: 2.8 }
    ],
    su57: [
      { x: nozzleX('su57'), y: -7, spread: 3 },
      { x: nozzleX('su57'), y: 7, spread: 3 }
    ],
    su30: [
      { x: nozzleX('su30'), y: -9, spread: 3.2 },
      { x: nozzleX('su30'), y: 9, spread: 3.2 }
    ],
    su25: [
      { x: nozzleX('su25'), y: -5, spread: 3.5 },
      { x: nozzleX('su25'), y: 5, spread: 3.5 }
    ]
  };

  function drawFlameAt(x, y, spread, boosting) {
    const len = boosting ? 24 + Math.sin(performance.now() / 40) * 4 : 8 + Math.sin(performance.now() / 60) * 2;
    const grad = ctx.createLinearGradient(x, y, x - len, y);
    grad.addColorStop(0, boosting ? '#fff4c2' : '#ffb37a');
    grad.addColorStop(0.5, boosting ? '#ff8a3d' : '#ff6a3d');
    grad.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y - spread);
    ctx.lineTo(x - len, y);
    ctx.lineTo(x, y + spread);
    ctx.closePath();
    ctx.fill();
  }

  function drawFlames(type, boosting) {
    for (const n of NOZZLES[type]) {
      drawFlameAt(n.x, n.y, n.spread, boosting);
    }
  }

  function drawSprite(type) {
    const img = SPRITES[type];
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    const h = SPRITE_LENGTH[type];
    const w = h * (img.naturalWidth / img.naturalHeight);
    // source art faces nose-up; rotate 90deg so it aligns with the nose-right convention
    ctx.save();
    // these sprites are downscaled a lot from their source resolution; nearest-neighbor
    // sampling of that on a moving/rotating target causes shimmering fine detail, so
    // use smoothing here even though the rest of the canvas stays crisp/unsmoothed
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  function drawJet(j, boosting) {
    ctx.save();
    ctx.translate(Math.round(j.x), Math.round(j.y));
    ctx.scale(j.dir, 1);
    ctx.rotate(j.bank + j.angle);

    drawFlames(j.aircraft, boosting);
    drawSprite(j.aircraft);

    ctx.restore();
  }

  // ---- Update loop ----
  let lastTime = performance.now();

  function update(j, dt, now) {
    const boosting = now < j.boostUntil;
    j.speed = boosting ? j.baseSpeed * 2.6 : j.baseSpeed;

    const margin = 65;
    const bobSpeed = 0.0016;

    switch (j.state) {
      case 'cruise':
      case 'boost': {
        j.x += j.dir * j.speed * dt * 0.06;
        j.bank = 0;

        if ((j.dir === 1 && j.x > width - margin) || (j.dir === -1 && j.x < margin)) {
          j.state = 'turning';
          j.stateTime = 0;
        } else if (now > j.nextTrick && j.x > margin * 1.5 && j.x < width - margin * 1.5) {
          j.state = 'loop';
          j.stateTime = 0;
        } else if (!boosting && j.state === 'boost') {
          j.state = 'cruise';
        }
        break;
      }
      case 'turning': {
        j.stateTime += dt;
        const duration = 500;
        const t = Math.min(1, j.stateTime / duration);
        j.bank = Math.sin(t * Math.PI) * 1.1 * j.dir * -1;
        j.x += j.dir * j.speed * dt * 0.02;
        if (t >= 1) {
          j.dir *= -1;
          j.bank = 0;
          j.state = 'cruise';
          j.nextTrick = now + randRange(5000, 11000);
        }
        break;
      }
      case 'loop': {
        j.stateTime += dt;
        const duration = 900;
        const t = Math.min(1, j.stateTime / duration);
        j.angle = t * Math.PI * 2 * j.dir;
        j.x += j.dir * j.speed * dt * 0.03;
        if (t >= 1) {
          j.angle = 0;
          j.state = 'cruise';
          j.nextTrick = now + randRange(6000, 13000);
        }
        break;
      }
    }

    // gentle altitude drift, clamped to canvas
    j.y += Math.sin(now * bobSpeed + j.x * 0.01 + j.id) * 0.15;
    j.y = Math.max(42, Math.min(height - 42, j.y));
    j.x = Math.max(30, Math.min(width - 30, j.x));

    j.trail.push({ x: j.x - j.dir * 30, y: j.y, boost: boosting });
    if (j.trail.length > 26) j.trail.shift();
  }

  function frame(now) {
    const dt = Math.min(48, now - lastTime);
    lastTime = now;

    if (width > 0 && height > 0) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = skyGradient();
      ctx.fillRect(0, 0, width, height);
      drawClouds(dt * 0.05);

      for (const j of jets) {
        update(j, dt, now);
        drawContrail(j);
      }
      for (const j of jets) {
        drawJet(j, now < j.boostUntil);
      }
    }

    requestAnimationFrame(frame);
  }

  for (const j of jets) {
    if (!j.y && height > 0) j.y = height / 2;
  }

  requestAnimationFrame(frame);
  setInterval(saveState, 2000);

  vscode.postMessage({ type: 'ready' });
})();
