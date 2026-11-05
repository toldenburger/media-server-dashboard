// The big copier at the front edge: your printer, drawn large. Data from sources/printer.py.
//  - the screen on its panel shows the printer's state, the ink levels and the page counts; while a job prints it shows the page it is on
//  - two cartridge windows on the front show the ink left (tri-colour and black); a level at or under 20 % blinks
//  - while it prints, sheets slide out of the side slot onto the tray, the scanner bar sweeps and the machine shakes a little
//  - the light on top: green ready, blue printing, amber low on ink, red out of paper / jam / stopped / offline
// Hover for the ink levels and the rest, double-click opens CUPS.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const bar = (p) => (p === null || p === undefined ? '–' : '▮'.repeat(Math.round(p / 10)) + '▯'.repeat(10 - Math.round(p / 10)) + ' ' + p + '%');
  const paperName = (m) => (m || '').replace(/^iso_|^na_/, '').replace(/_.*$/, '').toUpperCase();

  const BASE_X = -2.6;
  const C = kit.group(BASE_X, 0, 8.3);
  C.scale.setScalar(1.5);  // a big one
  const W = 1.35, D = 0.78;
  // paper cabinet with three drawers
  kit.rbox(W, 0.62, D, 0.04, '#d9dce4', 0, 0.31, 0, C);
  const drawerLeds = [0.12, 0.31, 0.5].map((y, i) => {
    kit.rbox(1.22, 0.16, 0.02, 0.01, '#c9ced8', 0, y, 0.395, C);
    kit.box(0.34, 0.025, 0.03, '#8d95a3', 0, y + 0.04, 0.41, C);
    return kit.ball(0.018, kit.mat('#4a2626', { emissive: '#ff4d4d', emissiveIntensity: 0 }), 0.52, y, 0.41, C);
  });
  [[-0.58, -0.32], [0.58, -0.32], [-0.58, 0.32], [0.58, 0.32]].forEach(([x, z]) => kit.cyl(0.04, 0.04, 0.03, '#2a2c35', x, 0.015, z, C));
  // the printing unit
  kit.rbox(W, 0.36, D, 0.05, '#eceef3', 0, 0.8, 0, C);
  kit.box(W - 0.06, 0.012, 0.012, '#b8bcc8', 0, 0.62, 0.395, C);
  // output slot and tray on the right side
  kit.box(0.03, 0.035, 0.46, '#2a2c35', W / 2 + 0.002, 0.8, 0, C);
  const tray = kit.group(W / 2 + 0.02, 0.74, 0, C);
  kit.box(0.5, 0.025, 0.5, '#cfd3dc', 0.25, 0, 0, tray).rotation.z = -0.08;
  [-0.25, 0.25].forEach((z) => kit.box(0.5, 0.05, 0.02, '#cfd3dc', 0.25, 0.03, z, tray));
  // scanner on top: frame, glass, a lid standing open at the back, and the sweeping light bar
  kit.rbox(W + 0.02, 0.1, D + 0.02, 0.03, '#cfd3dc', 0, 1.03, 0, C);
  kit.box(W - 0.16, 0.006, D - 0.14, '#b9d4e6', 0, 1.083, -0.02, C).material = kit.mat('#b9d4e6', { emissive: '#7fb3d8', emissiveIntensity: 0.25 });
  const lidHinge = kit.group(0, 1.09, -D / 2, C);
  lidHinge.rotation.x = -1.75;
  kit.rbox(W, 0.06, D, 0.02, '#f4f5f8', 0, 0.03, D / 2, lidHinge);
  kit.box(W - 0.1, 0.01, D - 0.08, '#e3e5eb', 0, -0.005, D / 2, lidHinge);
  const scanBar = kit.box(W - 0.22, 0.012, 0.03, '#ffffff', 0, 1.09, 0, C);
  scanBar.material = kit.mat('#ffffff', { emissive: '#d8f0ff', emissiveIntensity: 0 });
  scanBar.castShadow = false; scanBar.visible = false;

  // cartridge windows on the front (tri-colour and black)
  const stripes = kit.canvasTexture(32, 32, (g) => { ['#00c8ff', '#ff3fb0', '#ffd93a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * 10.7, 0, 11, 32); }); });
  const windows = [{ x: -0.55, color: null }, { x: -0.38, color: '#262830' }].map((w, i) => {
    kit.rbox(0.13, 0.27, 0.012, 0.01, '#14151b', w.x, 0.8, 0.395, C);
    const mat = i === 0 ? new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#3a3d4a', roughness: 0.6 });
    const fill = kit.plane(0.1, 0.23, mat, w.x, 0.8, 0.403, 0, 0, C);
    const frame = kit.box(0.14, 0.28, 0.006, '#ff4d4d', w.x, 0.8, 0.392, C);
    frame.visible = false;
    return { fill, frame, x: w.x };
  });
  const lamp = kit.ball(0.03, kit.mat('#4ade80', { emissive: '#4ade80', emissiveIntensity: 0.8 }), -0.62, 0.98, 0.36, C);
  lamp.castShadow = false;

  // control panel with the screen
  const panel = kit.group(0.3, 1.1, 0.3, C);
  panel.rotation.x = 0.75;
  kit.rbox(0.66, 0.04, 0.3, 0.015, '#2b2d36', 0, 0, 0, panel);
  const tex = kit.canvasTexture(384, 160, (g, w, h, d) => {
    g.fillStyle = '#0f1620'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (!d || !d.ok) { g.fillStyle = '#5d6b84'; g.font = `700 34px ${FONT}`; g.fillText('PRINTER', 16, 56); g.font = `600 28px ${FONT}`; g.fillText(d ? 'offline' : 'no data', 16, 100); return; }
    g.fillStyle = '#7fb3d8'; g.font = `700 22px ${FONT}`; g.fillText(d.name.slice(0, 26), 14, 28);
    const big = (text, color) => { g.fillStyle = color; g.font = `800 44px ${FONT}`; g.fillText(text, 14, 82); };
    if (d.state === 'stopped') big('STOPPED', '#ff6b6b');
    else if (d.jam) big('PAPER JAM', '#ff6b6b');
    else if (d.paper_out) big('NO PAPER', '#ff6b6b');
    else if (d.cover_open) big('COVER OPEN', '#ffb347');
    else if (d.state === 'printing') {
      big('PRINTING' + '.'.repeat(1 + (d.tick % 3)), '#6fd0ff');
      const p = d.printing;
      if (p) {
        g.fillStyle = '#c8e8ff'; g.font = `600 24px ${FONT}`;
        g.fillText(p.pages ? `page ${Math.min(p.pages, p.pages_done + 1)} of ${p.pages}` : `${p.pages_done} pages out`, 16, 112);
        if (p.pages) { g.fillStyle = '#1f2c3c'; g.fillRect(16, 124, 352, 12); g.fillStyle = '#4fb3ff'; g.fillRect(16, 124, 352 * Math.min(1, p.pages_done / p.pages), 12); }
      }
    } else big('READY', '#6fe39a');
    if (d.state !== 'printing' || !d.printing) {
      g.fillStyle = '#9fb1cc'; g.font = `500 22px ${FONT}`;
      g.fillText(`${d.pages_today} today` + (d.pages_total ? ` · ${d.pages_total} total` : '') + (d.queued ? ` · ${d.queued} waiting` : ''), 16, 112);
    }
    // ink bars along the bottom
    d.ink.slice(0, 2).forEach((ink, i) => {
      const x = 16 + i * 180;
      g.fillStyle = '#1f2c3c'; g.fillRect(x, 126, 160, 14);
      if (ink.level !== null) { g.fillStyle = ink.low ? '#ff6b6b' : ink.black ? '#d8dde8' : '#ff8fd0'; g.fillRect(x, 126, 160 * ink.level / 100, 14); }
      g.fillStyle = '#9fb1cc'; g.font = `500 16px ${FONT}`; g.fillText(`${ink.black ? 'K' : 'CMY'} ${ink.level === null ? '?' : ink.level + '%'}`, x, 156);
    });
  });
  kit.plane(0.6, 0.25, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.85 }), 0, 0.025, 0, 0, -Math.PI / 2, panel);

  // sheets sliding out onto the tray, and the stack on it
  const paperTex = kit.canvasTexture(128, 92, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9aa4b8';
    for (let i = 0; i < 7; i++) g.fillRect(10, 12 + i * 10, i % 3 === 2 ? 60 : 108, 4);
  });
  const sheets = [0, 1, 2].map(() => {
    const m = kit.plane(0.4, 0.29, new THREE.MeshStandardMaterial({ map: paperTex, side: THREE.DoubleSide }), 0, 0, 0, 0, -Math.PI / 2, C);
    m.visible = false; m.castShadow = false;
    return m;
  });
  const pile = kit.box(0.4, 0.01, 0.29, '#f6f7fa', W / 2 + 0.27, 0.77, 0, C);
  pile.visible = false;

  const hit = kit.box(W + 0.55, 1.25, D, '#000000', 0.2, 0.62, 0, C);
  hit.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  hit.castShadow = false;

  let data = null, drawn = '', shake = 0;
  const tip = () => {
    const d = data;
    if (!d || !d.ok) return 'Printer\nNot answering';
    const state = d.state === 'stopped' ? 'Stopped' : d.jam ? 'Paper jam' : d.paper_out ? 'Out of paper' : d.cover_open ? 'Cover open' : d.state === 'printing'
      ? (d.printing && d.printing.pages ? `Printing page ${Math.min(d.printing.pages, d.printing.pages_done + 1)} of ${d.printing.pages}` : 'Printing…') : 'Ready';
    const lines = [d.name, state + (d.queued ? ` · ${d.queued} in the queue` : ''), '', 'Ink:'];
    d.ink.forEach((i) => lines.push(`${i.name}  ${bar(i.level)}${i.low ? '  ⚠ low' : ''}`));
    lines.push('', `Paper: ${d.paper_out ? 'EMPTY' : d.paper.length ? d.paper.map(paperName).join(', ') + ' loaded' : 'unknown'}`);
    lines.push(`Pages: ${d.pages_today} today${d.pages_total ? ' · ' + d.pages_total + ' in total' : ''}${d.jams ? ' · ' + d.jams + ' jams so far' : ''}`);
    return lines.join('\n');
  };
  kit.tipOn(hit, tip, 'printer');

  return {
    update(d) {
      const p = d.extra && d.extra.printer;
      data = p && p.ok ? { ...p, tick: 0 } : p || null;
      if (data && data.ok) data.tick = Math.floor(Date.now() / 600);
      const key = JSON.stringify(data && [data.state, data.printing, data.ink, data.pages_today, data.paper_out, data.jam, data.queued, data.tick % 3]);
      if (key !== drawn) { drawn = key; tex.redraw(data); }
    },
    frame(dt, t) {
      const d = data && data.ok ? data : null;
      const printing = !!d && d.state === 'printing';
      if (printing) shake = 1; else shake = Math.max(0, shake - dt * 1.5);
      C.position.x = BASE_X + (printing ? Math.sin(t * 60) * 0.003 : 0);
      // light on top
      const col = !d ? '#5d6b84' : d.state === 'stopped' || d.jam || d.paper_out || d.cover_open ? '#ff4d4d' : printing ? '#4fb3ff' : d.ink_low ? '#ffb347' : '#4ade80';
      lamp.material.color.set(col); lamp.material.emissive.set(col);
      lamp.material.emissiveIntensity = printing ? 1.0 + 0.7 * Math.sin(t * 8) : 0.8;
      // cartridge windows
      windows.forEach((w, i) => {
        const ink = d && d.ink[i];
        const level = ink && ink.level !== null ? ink.level / 100 : 0;
        w.fill.scale.y = Math.max(0.02, level);
        w.fill.position.y = 0.8 - 0.115 + 0.115 * w.fill.scale.y;
        w.frame.visible = !!(ink && ink.low) && Math.sin(t * 5) > 0;
      });
      drawerLeds[0].material.emissiveIntensity = d && d.paper_out ? 1.2 + 0.6 * Math.sin(t * 6) : 0;
      // scanner bar and sheets while printing
      scanBar.visible = printing;
      if (printing) {
        scanBar.position.z = Math.sin(t * 2.6) * (D / 2 - 0.12);
        scanBar.material.emissiveIntensity = 1.2;
      }
      sheets.forEach((s, i) => {
        const k = printing ? ((t / 2.4 + i / 3) % 1) : 0;
        s.visible = printing;
        if (!printing) return;
        s.position.set(W / 2 - 0.15 + k * 0.45, 0.82 - Math.max(0, k - 0.75) * 0.2, 0);
      });
      pile.visible = printing || shake > 0.05;
      if (d && d.printing) pile.scale.y = 1 + Math.min(14, d.printing.pages_done) * 0.5;
    },
  };
}
