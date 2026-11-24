/* Floating flowers and maple leaves on white. Cached sprites; motion pauses off-screen. */
(() => {
  const canvas = document.querySelector('#flower-garden');
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
  const mapleSprites = [
    ['#f2d893','#d2ae60','#a88b43'],
    ['#e0e3b9','#b1ba7c','#7d8a4b'],
    ['#f0dfb7','#d4b67e','#b3945b'],
  ].map(makeMaple);
  let width = 0;
  let height = 0;
  let flowers = [];
  let leaves = [];
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

  function makeMaple(palette) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 192;
    const brush = sprite.getContext('2d');
    brush.translate(96,88);
    const tint = brush.createLinearGradient(-35,-55,38,55);
    tint.addColorStop(0,palette[0]); tint.addColorStop(.55,palette[1]); tint.addColorStop(1,palette[2]);
    brush.fillStyle = tint;
    brush.shadowColor = '#64714030'; brush.shadowBlur = 7; brush.shadowOffsetY = 5;
    const points = [[0,-67],[-14,-36],[-28,-47],[-23,-14],[-50,-27],[-44,-7],[-68,-2],[-47,17],[-54,34],[-16,28],[-21,53],[0,42],[22,53],[17,28],[55,34],[48,17],[68,-2],[45,-7],[51,-27],[24,-14],[29,-47],[14,-36]];
    brush.beginPath();
    points.forEach(([x,y],index)=>index ? brush.lineTo(x,y) : brush.moveTo(x,y));
    brush.closePath(); brush.fill();
    brush.shadowColor = 'transparent';
    brush.strokeStyle = palette[2]; brush.lineWidth = 3; brush.lineCap = 'round';
    brush.beginPath(); brush.moveTo(0,34); brush.quadraticCurveTo(1,53,6,69); brush.stroke();
    brush.strokeStyle = '#fff7da80'; brush.lineWidth = 1.4;
    for (const [x,y] of [[0,-55],[-39,-14],[40,-15],[-38,25],[39,25]]) {
      brush.beginPath(); brush.moveTo(0,35); brush.quadraticCurveTo(x*.2,5,x,y); brush.stroke();
    }
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
    leaves = Array.from({ length: mobile ? 9 : 14 }, (_,index) => ({
      x: random(), y: random(), phase: random()*Math.PI*2,
      size: (mobile ? 43 : 57)+random()*24,
      speed: .65+random()*.7, depth: .4+random()*.6,
      rotation: random()*Math.PI*2,
      sprite: mapleSprites[index%mapleSprites.length],
    }));
    canvas.dataset.flowers = String(count);
    canvas.dataset.leaves = String(leaves.length);
    paint();
  }

  const wrap = (value, limit, margin) => ((value + margin) % (limit + margin * 2) + limit + margin * 2) % (limit + margin * 2) - margin;

  function paint() {
    context.clearRect(0, 0, width, height);
    for (const leaf of leaves) {
      const x = wrap(leaf.x*width+time*3*leaf.speed+Math.sin(time*.3+leaf.phase)*28+pointer.x*leaf.depth,width,65);
      const y = wrap(leaf.y*height+time*5*leaf.speed-scroll*.1*leaf.depth+Math.cos(time*.2+leaf.phase)*14,height,65);
      context.save(); context.translate(x,y);
      context.rotate(leaf.rotation+Math.sin(time*.35+leaf.phase)*.3+time*.035);
      context.globalAlpha = .72;
      context.drawImage(leaf.sprite,-leaf.size/2,-leaf.size/2,leaf.size,leaf.size);
      context.restore();
    }
    for (const flower of flowers) {
      const x = wrap(flower.x * width + time * 5 * flower.speed
        + Math.sin(time * .33 + flower.phase) * 24 + pointer.x * flower.depth, width, 65);
      const y = wrap(flower.y * height - time * 3.5 * flower.speed
        + Math.cos(time * .27 + flower.phase) * 17 - scroll * .08 * flower.depth + pointer.y * flower.depth, height, 65);
      context.save();
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
  document.addEventListener('visibilitychange', motion);
  reducedMotion.addEventListener('change', motion);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', motion);
  resize();
  motion();
})();
