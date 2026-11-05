// Things measured with a smart plug, drawn where they live in the office. Data from sources/homeassistant.py ("devices").
//  - the coffee machine in the kitchen: a counter on the wall for today's cups, a red light while it heats, a cup that fills and steams
//    while it brews. Hover it for the numbers, double-click opens Home Assistant.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const KEY = 'coffee';
  const BREW_S = 28;  // how long a cup takes to fill in the picture
  const ago = (unix) => { const m = Math.max(1, Math.round((Date.now() / 1000 - unix) / 60)); return m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
  const hhmm = (unix) => new Date(unix * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // the machine stands at (1.15, 0.95, -8.62) facing the room (see office.html)
  const M = kit.group(1.15, 0.95, -8.62);
  const led = kit.ball(0.03, kit.mat('#ff6b5e', { emissive: '#ff3b2e', emissiveIntensity: 0 }), 0, 0.58, 0.235, M);
  led.castShadow = false;
  const standby = kit.ball(0.02, kit.mat('#7ee08a', { emissive: '#4ade80', emissiveIntensity: 0.4 }), -0.15, 0.58, 0.235, M);
  standby.castShadow = false;

  // the cup in front of the spout, with the coffee rising in it and a thin stream from the spout while it brews
  const cup = kit.group(0, -0.0, 0.26, M);
  const stream = kit.box(0.012, 0.27, 0.012, '#4a2c1a', 0, 0.25, -0.05, cup);
  stream.visible = false;
  kit.cyl(0.055, 0.045, 0.11, '#ffffff', 0, 0.055, 0, cup);
  kit.torus(0.032, 0.01, Math.PI, '#ffffff', 0.06, 0.06, 0, cup).rotation.z = -Math.PI / 2;
  const coffee = kit.cyl(0.046, 0.04, 0.1, '#4a2c1a', 0, 0.05, 0, cup);
  cup.visible = false;
  coffee.scale.y = 0.05;

  const puffTex = kit.canvasTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const puffs = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    M.add(s);
    return { s, i };
  });

  // the cup counter: a little sign on the counter beside the machine
  const tex = kit.canvasTexture(384, 256, (g, w, h, d) => {
    g.fillStyle = '#14100c'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#c9a070'; g.font = `700 36px ${FONT}`; g.fillText('☕ COFFEE', 20, 52);
    if (!d || d.error) { g.fillStyle = '#7a6a58'; g.font = `600 44px ${FONT}`; g.fillText('no reading', 20, 160); return; }
    g.fillStyle = '#ffd9a0'; g.font = `800 120px ${FONT}`; g.fillText(String(d.cups), 20, 170);
    g.fillStyle = '#c9a070'; g.font = `600 40px ${FONT}`; g.fillText(d.cups === 1 ? 'cup today' : 'cups today', 40 + String(d.cups).length * 66, 170);
    g.fillStyle = '#8a7660'; g.font = `500 32px ${FONT}`;
    g.fillText(`${d.last ? 'last ' + hhmm(d.last) : 'none yet'}${d.kwh !== null && d.kwh !== undefined ? ' · ' + d.kwh.toFixed(2) + ' kWh' : ''}`, 20, 228);
  });
  const sign = kit.group(1.58, 0.95, -8.36, undefined, 0.6);
  [-0.15, 0.15].forEach((x) => kit.box(0.03, 0.12, 0.03, '#3a2f26', x, 0.06, 0, sign));
  kit.rbox(0.4, 0.27, 0.025, 0.01, '#2b2218', 0, 0.2, 0, sign).rotation.x = -0.2;
  kit.plane(0.37, 0.247, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.7 }), 0, 0.2, 0.016, 0, -0.2, sign);

  const hit = kit.box(0.66, 0.85, 0.55, '#000000', 1.15, 1.35, -8.62);
  hit.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  hit.castShadow = false;

  let data = null, shown = '';
  const tip = () => {
    if (!data || data.error) return 'Coffee machine\nNo reading from the plug';
    return ['Coffee machine', data.active ? 'Making a coffee…' : data.state === 'warming' ? 'Warming up…' : data.standby ? 'Ready' : 'Off', `${data.cups} ${data.cups === 1 ? 'cup' : 'cups'} today${data.last ? ' · last ' + hhmm(data.last) + ' (' + ago(data.last) + ')' : ''}`,
      `Now ${Math.round(data.watts)} W${data.kwh !== null && data.kwh !== undefined ? ' · ' + data.kwh.toFixed(2) + ' kWh today' : ''}`].join('\n');
  };
  kit.tipOn(hit, tip, 'homeassistant');
  kit.tipOn(sign, tip, 'homeassistant');

  return {
    update(d) {
      const ha = d.extra && d.extra.homeassistant;
      const dev = ha && ha.ok && ha.devices && ha.devices[KEY];
      if (!dev || dev.error) { data = dev || null; if (shown !== 'x') { shown = 'x'; tex.redraw(null); } return; }
      const runs = dev.runs || [];
      data = {
        watts: dev.watts || 0, kwh: dev.kwh_today, active: dev.active, state: dev.state, standby: (dev.watts || 0) > 0.5, cups: runs.length,
        last: runs.length ? runs[runs.length - 1][1] : null, start: dev.active && runs.length ? runs[runs.length - 1][0] : null, lastEnd: runs.length ? runs[runs.length - 1][1] : 0,
      };
      const key = JSON.stringify([data.cups, data.last, data.kwh, !!data.watts]);
      if (key !== shown) { shown = key; tex.redraw(data); }
    },
    frame(dt, t) {
      const now = Date.now() / 1000;
      const brewing = !!(data && data.active);
      const lingering = !!(data && !data.active && data.lastEnd && now - data.lastEnd < 25);
      const warming = !!(data && data.state === 'warming');
      const lamp = warming ? '#ffb347' : '#ff3b2e';
      led.material.color.set(warming ? '#ffb347' : '#ff6b5e'); led.material.emissive.set(lamp);
      led.material.emissiveIntensity = brewing ? 1.4 + 0.5 * Math.sin(t * 6) : warming ? 1.0 + 0.5 * Math.sin(t * 3) : 0;
      standby.material.emissiveIntensity = data && data.standby ? 0.5 : 0;
      cup.visible = brewing || lingering;
      stream.visible = brewing;
      if (brewing && data.start) coffee.scale.y = Math.min(1, 0.05 + (now - data.start) / BREW_S);
      else if (lingering) coffee.scale.y = 1;
      puffs.forEach((p) => {
        const k = ((t * 0.4 + p.i / 3) % 1);
        p.s.position.set(Math.sin(k * 4 + p.i) * 0.03, 0.2 + k * 0.4, 0.26);
        p.s.scale.setScalar(0.12 + k * 0.2);
        p.s.material.opacity = cup.visible ? Math.sin(k * Math.PI) * 0.6 : 0;
      });
    },
  };
}
