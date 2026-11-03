// The Pi-hole bouncer: stands by the door behind a velvet rope. Every blocked query is a red cross that
// flies at the door and bounces off. A sandwich board beside him shows the day's numbers. (sources/pihole.py)
export default function (kit) {
  const { THREE } = kit;
  const DOOR_X = -11.95, DOOR_Z = 4.1, ROPE_X = -10.55, FONT = '"Segoe UI", system-ui, sans-serif';
  const gold = '#d8b45a';

  const guard = kit.spawn('Pi-hole', {
    color: '#1c1c24', trim: '#b8322f', pants: '#14141a', hair: '#0d0d10', style: 'short', skin: '#8a5a3b', extra: 'glasses', eye: '#2a1d14',
    quips: ['Nobody gets past me', 'Ads? Not tonight', 'Guest list checked'],
  }, { at: [-11.1, 1.45], face: 1.1 });

  // velvet rope: two posts and a sagging red rope parallel to the wall
  const post = (z) => {
    kit.cyl(0.14, 0.16, 0.05, gold, ROPE_X, 0.025, z);
    kit.cyl(0.03, 0.03, 0.85, gold, ROPE_X, 0.45, z);
    kit.ball(0.065, gold, ROPE_X, 0.9, z);
  };
  post(3.25); post(4.95);
  const rope = kit.cyl(0.028, 0.028, 1.7, '#b8322f', ROPE_X, 0.8, DOOR_Z);
  rope.rotation.x = Math.PI / 2;

  // sandwich board
  const W = 360, H = 480;
  const tex = kit.canvasTexture(W, H, (g, w, h, d) => {
    g.fillStyle = '#23252e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2c94c'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = 'center'; g.fillStyle = '#f2c94c'; g.font = `800 34px ${FONT}`; g.fillText('BLOCKED TODAY', w / 2, 62);
    if (!d) { g.fillStyle = '#9aa0b4'; g.font = `600 26px ${FONT}`; g.fillText('counting…', w / 2, 200); return; }
    g.fillStyle = '#ffffff'; g.font = `800 84px ${FONT}`; g.fillText(d.blocked.toLocaleString('en-GB'), w / 2, 160);
    g.fillStyle = '#ff6b6b'; g.font = `700 44px ${FONT}`; g.fillText(`${d.percent}%`, w / 2, 215);
    g.fillStyle = '#9aa0b4'; g.font = `500 22px ${FONT}`; g.fillText(`of ${d.total.toLocaleString('en-GB')} queries · ${d.clients} devices`, w / 2, 250);
    g.textAlign = 'left'; g.fillStyle = '#f2c94c'; g.font = `700 22px ${FONT}`; g.fillText('MOST TURNED AWAY', 30, 295);
    g.font = `500 21px ${FONT}`; g.fillStyle = '#e9ecf2';
    d.top_blocked.slice(0, 5).forEach((t, i) => {
      let name = t.domain;
      while (name.length > 3 && g.measureText(name).width > w - 120) name = name.slice(0, -1);
      g.fillText(name + (name !== t.domain ? '…' : ''), 30, 330 + i * 30);
      g.textAlign = 'right'; g.fillStyle = '#ff9b9b'; g.fillText(String(t.count), w - 30, 330 + i * 30); g.textAlign = 'left'; g.fillStyle = '#e9ecf2';
    });
    if (d.blocking !== 'enabled') { g.fillStyle = 'rgba(190,40,40,.92)'; g.fillRect(20, 190, w - 40, 70); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 40px ${FONT}`; g.fillText('BLOCKING PAUSED', w / 2, 238); }
  });
  const board = kit.group(-11.0, 0, 0.15, undefined, 1.35);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const leaf = kit.group(0, 0, side * 0.2, board);
    leaf.rotation.x = -side * 0.2;
    kit.box(0.62, 0.86, 0.04, '#5a4632', 0, 0.45, 0, leaf);
    kit.plane(0.56, 0.56 * H / W, faceMat, 0, 0.47, side * 0.025, side > 0 ? 0 : Math.PI, 0, leaf);
  }
  const boardTip = () => `Pi-hole\nWhat it turned away (last 24 hours)`;

  // crosses flying at the door
  const crossTex = kit.canvasTexture(64, 64, (g) => {
    g.fillStyle = '#e24b4b'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, 20); g.lineTo(44, 44); g.moveTo(44, 20); g.lineTo(20, 44); g.stroke();
  });
  const sprites = Array.from({ length: 14 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: crossTex, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.22); s.visible = false; kit.scene.add(s); return s;
  });
  const live = [], queue = [];
  let data = null, shown = '';

  function launch() {
    const s = sprites.find((x) => !x.visible);
    if (!s) return;
    s.visible = true; s.material.opacity = 1;
    s.position.set(-6.5 - Math.random() * 2, 0.9 + Math.random() * 0.7, 3.2 + Math.random() * 1.8);
    live.push({ s, vx: -3.2 - Math.random() * 0.8, vy: 1.4 + Math.random(), vz: (Math.random() - 0.5) * 0.4, bounced: false, age: 0 });
  }

  return {
    update(d) {
      const p = d.extra && d.extra.pihole;
      if (!p || !p.ok) { guard.say = 'Pi-hole\nNot answering'; return; }
      data = p;
      const key = JSON.stringify([p.blocked, p.total, p.clients, p.blocking, p.top_blocked]);
      if (key !== shown) { shown = key; tex.redraw(p); }
      for (let i = 0; i < Math.min(p.fresh_blocked, 10); i++) queue.push(performance.now() + Math.random() * 9000);
      guard.say = () => `Pi-hole\n${p.blocking === 'enabled' ? 'Guarding the door' : 'Off duty: blocking is paused'}\n${p.blocked.toLocaleString('en-GB')} turned away today (${p.percent}%)\nMost wanted: ${p.top_blocked[0] ? p.top_blocked[0].domain : '-'}`;
    },
    frame(dt, t) {
      // arms crossed, standing tall (set after the shared animation runs)
      guard.shoulderL.rotation.set(-0.95, 0, -0.55); guard.shoulderR.rotation.set(-0.95, 0, 0.55);
      guard.elbowL.rotation.x = guard.elbowR.rotation.x = -1.9;
      guard.head.rotation.y = Math.sin(t * 0.35) * 0.5 + 0.3;
      const now = performance.now();
      while (queue.length && queue[0] <= now) { queue.shift(); launch(); }
      for (let i = live.length - 1; i >= 0; i--) {
        const c = live[i];
        c.age += dt; c.vy -= 5 * dt;
        c.s.position.x += c.vx * dt; c.s.position.y += c.vy * dt; c.s.position.z += c.vz * dt;
        if (c.s.position.y < 0.15) { c.s.position.y = 0.15; c.vy = Math.abs(c.vy) * 0.45; }
        if (!c.bounced && c.s.position.x <= ROPE_X) { c.bounced = true; c.vx = -c.vx * 0.35; c.vy = 1.6; }  // bounces off the guard's line
        if (c.bounced) c.s.material.opacity = Math.max(0, 1 - (c.age - 1.4) / 1.2);
        if (c.age > 3.4 || c.s.material.opacity <= 0) { c.s.visible = false; live.splice(i, 1); }
      }
    },
    tipTargets: { board, guard },
  };
}
