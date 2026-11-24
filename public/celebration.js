/* A brief maple-leaf burst in the dinner dialog's top layer. */
(() => {
  const dialog = document.querySelector('#dinner-dialog');
  const canvas = document.querySelector('#dinner-leaf-burst');
  const brush = canvas?.getContext('2d');
  if (!dialog || !brush) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const palettes = [['#f1db9e','#bc9242','#8b692d'],['#d8dfac','#a0ad66','#738244'],['#edc38b','#cb9861','#9d703c']];
  const outline = [[0,-67],[-14,-36],[-28,-47],[-23,-14],[-50,-27],[-44,-7],[-68,-2],[-47,17],[-54,34],[-16,28],[-21,53],[0,42],[22,53],[17,28],[55,34],[48,17],[68,-2],[45,-7],[51,-27],[24,-14],[29,-47],[14,-36]];
  const sprites = palettes.map(palette => {
    const leaf = document.createElement('canvas'); leaf.width = leaf.height = 160;
    const ink = leaf.getContext('2d'); ink.translate(80,76);
    const gold = ink.createLinearGradient(-40,-55,35,50);
    gold.addColorStop(0,palette[0]); gold.addColorStop(.6,palette[1]); gold.addColorStop(1,palette[2]);
    ink.fillStyle=gold; ink.shadowColor='#4b421f38'; ink.shadowBlur=4; ink.shadowOffsetY=3;
    ink.beginPath(); outline.forEach(([x,y],index) => index ? ink.lineTo(x,y) : ink.moveTo(x,y)); ink.closePath(); ink.fill();
    ink.shadowColor='transparent'; ink.strokeStyle=palette[2]; ink.lineWidth=2;
    ink.beginPath(); ink.moveTo(0,34); ink.quadraticCurveTo(1,53,6,68); ink.stroke();
    ink.strokeStyle='#fff5ce99'; ink.lineWidth=1.5;
    for (const [x,y] of [[0,-56],[-40,-15],[41,-15],[-39,25],[40,25]]) {
      ink.beginPath(); ink.moveTo(0,35); ink.quadraticCurveTo(x*.2,5,x,y); ink.stroke();
    }
    return leaf;
  });
  let frame=0;
  let particles=[];
  let started=0;
  let width=0;
  let height=0;
  function stop() {
    cancelAnimationFrame(frame); frame=0; particles=[];
    brush.clearRect(0,0,width,height);
    canvas.dataset.active='false'; canvas.dataset.particles='0';
  }
  function paint(now) {
    if (!dialog.open || document.hidden || reduced.matches) { stop(); return; }
    const elapsed=(now-started)/1000;
    brush.clearRect(0,0,width,height);
    let alive=0;
    for (const leaf of particles) {
      const progress=elapsed/leaf.life;
      if (progress>=1) continue;
      alive++;
      const travel=(1-Math.exp(-elapsed*1.35))/1.35;
      const x=width*.5+leaf.vx*travel+Math.sin(elapsed*3+leaf.phase)*14*elapsed;
      const y=height*.44+leaf.vy*travel+elapsed*elapsed*78;
      brush.save(); brush.translate(x,y); brush.rotate(leaf.rotation+elapsed*leaf.spin);
      brush.globalAlpha=Math.min(1,elapsed*12)*Math.min(1,(1-progress)*3);
      brush.scale(1,.7+Math.sin(elapsed*4+leaf.phase)*.3);
      brush.drawImage(leaf.sprite,-leaf.size/2,-leaf.size/2,leaf.size,leaf.size); brush.restore();
    }
    if (alive) frame=requestAnimationFrame(paint); else stop();
  }
  function burst() {
    stop();
    if (!dialog.open || reduced.matches) return;
    width=innerWidth; height=innerHeight;
    const ratio=Math.min(devicePixelRatio || 1,1.5);
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    brush.setTransform(ratio,0,0,ratio,0,0);
    const count=width<=760 ? 30 : 46;
    particles=Array.from({length:count},(_,index) => {
      const angle=(index/count)*Math.PI*2+Math.random()*.3;
      const speed=150+Math.random()*Math.min(width*.65,440);
      return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-120,size:22+Math.random()*27,life:1.6+Math.random()*.7,rotation:Math.random()*Math.PI*2,spin:(Math.random()-.5)*6,phase:Math.random()*6,sprite:sprites[index%sprites.length]};
    });
    canvas.dataset.active='true'; canvas.dataset.particles=String(count);
    canvas.dataset.burst=String(Number(canvas.dataset.burst || 0)+1);
    started=performance.now(); frame=requestAnimationFrame(paint);
  }
  document.querySelector('#open-dinner').addEventListener('click',burst);
  dialog.addEventListener('close',stop);
  document.addEventListener('visibilitychange',() => { if (document.hidden) stop(); });
  reduced.addEventListener('change',() => { if (reduced.matches) stop(); });
  window.addEventListener('resize',stop);
})();
