// The Pi-hole bouncer: stands by the door with a sandwich board beside him showing the day's numbers. (sources/pihole.py)
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';

  const guard = kit.spawn('Pi-hole', {
    color: '#1c1c24', trim: '#b8322f', pants: '#14141a', hair: '#0d0d10', style: 'short', skin: '#8a5a3b', extra: 'glasses', eye: '#2a1d14',
    quips: ['Nobody gets past me', 'Ads? Not tonight', 'Guest list checked'],
  }, { at: [-11.1, 1.45], face: 1.1 });

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

  let shown = '';

  return {
    update(d) {
      const p = d.extra && d.extra.pihole;
      if (!p || !p.ok) { guard.say = 'Pi-hole\nNot answering'; return; }
      const key = JSON.stringify([p.blocked, p.total, p.clients, p.blocking, p.top_blocked]);
      if (key !== shown) { shown = key; tex.redraw(p); }
      guard.say = () => `Pi-hole\n${p.blocking === 'enabled' ? 'Guarding the door' : 'Off duty: blocking is paused'}\n${p.blocked.toLocaleString('en-GB')} turned away today (${p.percent}%)\nMost wanted: ${p.top_blocked[0] ? p.top_blocked[0].domain : '-'}`;
    },
    frame(dt, t) {
      // arms stay down; he only turns his head to watch the room
      guard.head.rotation.y = Math.sin(t * 0.35) * 0.5 + 0.3;
    },
  };
}
