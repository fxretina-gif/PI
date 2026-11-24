/* A white water garden. Flowers are cached sprites; motion pauses off-screen. */
(() => {
  const canvas = document.querySelector('#water-garden');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const palettes = [
    ['#fffdfa', '#f4d8d0', '#d6a99b'],
    ['#ffffff', '#e6ebd1', '#b6c08e'],
    ['#fffefa', '#f1e3b8', '#cfb779'],
    ['#ffffff', '#f0dce2', '#c9a3b0'],
  ];
  const sprites = palettes.map(makeFlower);
  let width = 0;
  let height = 0;
  let flowers = [];
  let pools = [];
  let touches = [];
  let frame = 0;
  let lastPaint = 0;
  let time = 0;
  let scroll = window.scrollY;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function makeFlower(palette) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 192;
    const brush = sprite.getContext('2d');
    brush.translate(96, 96);
    brush.shadowColor = '#5f70563d';
    brush.shadowBlur = 9;
    brush.shadowOffsetY = 7;
    // Five overlapping, shaded petals give each blossom a sculpted shape.
    for (let petal = 0; petal < 5; petal++) {
      brush.save();
      brush.rotate(petal * Math.PI * 2 / 5);
      const tint = brush.createLinearGradient(-24, -60, 20, 9);
      tint.addColorStop(0, palette[0]);
      tint.addColorStop(.47, palette[0]);
      tint.addColorStop(.78, palette[1]);
      tint.addColorStop(1, palette[2]);
      brush.fillStyle = tint;
      brush.beginPath();
      brush.moveTo(-5, 13);
      brush.bezierCurveTo(-24, 5, -43, -34, -17, -61);
      brush.bezierCurveTo(2, -81, 35, -50, 23, -23);
      brush.bezierCurveTo(16, -5, 8, 10, -5, 13);
      brush.fill();
      brush.shadowColor = 'transparent';
      brush.strokeStyle = '#ffffffc4';
      brush.lineWidth = 1.5;
      brush.beginPath();
      brush.moveTo(-13, -51);
      brush.bezierCurveTo(-22, -31, -11, -9, -3, 3);
      brush.stroke();
      brush.restore();
    }
    brush.shadowColor = 'transparent';
    const centre = brush.createRadialGradient(-3, -4, 1, 0, 0, 12);
    centre.addColorStop(0, '#fff4bb');
    centre.addColorStop(.5, '#daca87');
    centre.addColorStop(1, '#a69655');
    brush.fillStyle = centre;
    brush.beginPath();
    brush.arc(0, 0, 10, 0, Math.PI * 2);
    brush.fill();
    return sprite;
  }

  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const mobile = width <= 760;
    const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const random = randomSource(26112026);
    const count = mobile ? 26 : 42;
    const columns = mobile ? 4 : 7;
    const rows = Math.ceil(count / columns);
    flowers = Array.from({ length: count }, (_, index) => ({
      x: ((index % columns) + .12 + random() * .8) / columns,
      y: (Math.floor(index / columns) + random() * .9) / rows,
      size: (mobile ? 42 : 52) + random() * (mobile ? 26 : 44),
      speed: .65 + random() * .9,
      phase: random() * Math.PI * 2,
      rotation: random() * Math.PI * 2,
      sprite: sprites[index % sprites.length],
      depth: .4 + random() * .6,
    }));
    pools = Array.from({ length: mobile ? 7 : 12 }, () => ({
      x: random() * width,
      y: random() * height,
      phase: random(),
      size: 90 + random() * 140,
    }));
    canvas.dataset.flowers = String(count);
    touches = [];
    paint();
  }

  const wrap = (value, limit, margin) => ((value + margin) % (limit + margin * 2) + limit + margin * 2) % (limit + margin * 2) - margin;

  function water() {
    const rows = width <= 760 ? 12 : 16;
    for (let row = -1; row < rows + 1; row++) {
      context.beginPath();
      const baseline = height * row / rows;
      for (let x = -30; x <= width + 30; x += 24) {
        const y = baseline + Math.sin(x * .007 + time * .4 + row * .72) * 23
          + Math.sin(x * .019 - time * .6 + row) * 6;
        if (x === -30) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = row % 3 ? '#98beb42e' : '#99b9a83d';
      context.lineWidth = row % 3 ? 1 : 1.5;
      context.stroke();
    }
    for (const pool of pools) {
      const phase = (pool.phase + time * .045) % 1;
      rings(pool.x + Math.sin(time * .2 + pool.phase * 6) * 18, pool.y, 22 + phase * pool.size, .25 * (1 - phase));
    }
    for (const touch of touches) {
      const age = time - touch.born;
      rings(touch.x, touch.y, 8 + age * 66, .45 * Math.max(0, 1 - age / 3));
    }
    touches = touches.filter(touch => time - touch.born < 3);
  }

  function rings(x, y, radius, alpha) {
    context.save();
    context.strokeStyle = `rgba(114, 157, 143, ${alpha})`;
    context.lineWidth = 1.2;
    for (let ring = 0; ring < 3; ring++) {
      context.beginPath();
      context.ellipse(x, y, radius + ring * 13, (radius + ring * 13) * .48, -.12, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha *= .65;
    }
    context.restore();
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    water();
    for (const flower of flowers) {
      const x = wrap(flower.x * width + time * 5 * flower.speed
        + Math.sin(time * .33 + flower.phase) * 24 + pointer.x * flower.depth, width, 65);
      const y = wrap(flower.y * height - time * 3.5 * flower.speed
        + Math.cos(time * .27 + flower.phase) * 17 - scroll * .08 * flower.depth + pointer.y * flower.depth, height, 65);
      // A small wake makes the blossoms feel afloat rather than airborne.
      context.save();
      context.strokeStyle = '#98bfae59';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(x, y + flower.size * .18, flower.size * .65, flower.size * .23, -.12, 0, Math.PI * 2);
      context.stroke();
      context.translate(x, y);
      context.rotate(flower.rotation + Math.sin(time * .24 + flower.phase) * .3 + time * .025);
      context.globalAlpha = .88 + flower.depth * .12;
      context.drawImage(flower.sprite, -flower.size / 2, -flower.size / 2, flower.size, flower.size);
      context.restore();
    }
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (now - lastPaint < 1000 / 30) return;
    time += Math.min((now - lastPaint) / 1000, .08);
    lastPaint = now;
    pointer.x += (pointer.targetX - pointer.x) * .07;
    pointer.y += (pointer.targetY - pointer.y) * .07;
    scroll += (window.scrollY - scroll) * .08;
    paint();
  }

  function motion() {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.dataset.motion = reducedMotion.matches ? 'still' : 'flowing';
    if (reducedMotion.matches || document.hidden) {
      touches = [];
      paint();
      return;
    }
    lastPaint = performance.now();
    frame = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer.targetX = (event.clientX / width - .5) * 24;
    pointer.targetY = (event.clientY / height - .5) * 18;
  }, { passive: true });
  window.addEventListener('pointerout', event => {
    if (!event.relatedTarget) pointer.targetX = pointer.targetY = 0;
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (reducedMotion.matches) return;
    if (touches.length >= 8) touches.shift();
    touches.push({ x: event.clientX, y: event.clientY, born: time });
  }, { passive: true });
  document.addEventListener('visibilitychange', motion);
  reducedMotion.addEventListener('change', motion);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', motion);
  resize();
  motion();
})();
