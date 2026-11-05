// A radio on a little cabinet at the front edge on the wooden floor, just right of the plant. Data from sources/opodsync.py.
// It shows the podcast episode your apps played or synced last: the cover stands beside it, the display has the names, and the
// ON AIR light and the floating notes are on while something was played in the last twenty minutes. Hover for the details,
// double-click opens the Opodsync server.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const clock = (s) => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const ago = (unix) => { const m = Math.max(1, Math.round((Date.now() / 1000 - unix) / 60)); return m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  const device = (d) => (d || '').replace(/_/g, ' ').replace(/^antennapod/i, 'AntennaPod');

  const cab = kit.group(1.25, 0, 8.45);
  const wood = '#a8754a', dark = '#7a5232';
  kit.rbox(1.15, 0.7, 0.46, 0.03, wood, 0, 0.45, 0, cab);
  kit.rbox(1.2, 0.05, 0.5, 0.02, '#c99a68', 0, 0.82, 0, cab);
  [[-0.5, -0.19], [0.5, -0.19], [-0.5, 0.19], [0.5, 0.19]].forEach(([x, z]) => kit.box(0.05, 0.12, 0.05, dark, x, 0.06, z, cab));
  [-0.28, 0.28].forEach((x) => { kit.rbox(0.52, 0.56, 0.02, 0.01, '#b98558', x, 0.45, 0.235, cab); kit.ball(0.02, '#d9c9a0', x * 0.6 + (x < 0 ? 0.2 : -0.2), 0.45, 0.255, cab); });

  // the radio
  const radio = kit.group(-0.12, 0.845, 0, cab);
  const body = kit.rbox(0.78, 0.4, 0.26, 0.05, '#d9b070', 0, 0.2, 0, radio);
  kit.rbox(0.74, 0.36, 0.02, 0.03, '#2b2118', 0, 0.2, 0.125, radio);
  for (let i = 0; i < 7; i++) kit.box(0.2, 0.012, 0.01, '#6b5030', -0.24, 0.07 + i * 0.045, 0.14, radio);  // speaker grille
  const tex = kit.canvasTexture(384, 160, (g, w, h, r) => {
    g.fillStyle = '#0f1a14'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (!r || !r.last) { g.fillStyle = '#6fd69a'; g.font = `700 30px ${FONT}`; g.fillText('PODCASTS', 16, 60); g.fillStyle = '#3f7a5a'; g.font = `500 22px ${FONT}`; g.fillText('nothing played yet', 16, 100); return; }
    const l = r.last, fit = (text, px, wt, max) => { g.font = `${wt} ${px}px ${FONT}`; while (text.length > 3 && g.measureText(text).width > max) text = text.slice(0, -2); return text; };
    g.fillStyle = '#6fd69a'; g.fillText(fit(l.podcast, 26, 700, 352), 16, 38);
    const words = l.episode.split(' '), lines = ['', ''];
    g.font = `500 24px ${FONT}`;
    let at = 0;
    for (const w of words) { if (at === 0 && g.measureText((lines[0] + ' ' + w).trim()).width > 352) at = 1; lines[at] = (lines[at] + ' ' + w).trim(); }
    g.fillStyle = '#c8f5dc'; g.fillText(fit(lines[0], 24, 500, 352), 16, 76); if (lines[1]) g.fillText(fit(lines[1], 24, 500, 352), 16, 106);
    g.fillStyle = '#3f9a6a'; g.font = `500 21px ${FONT}`;
    g.fillText(fit(`${l.total ? clock(l.position) + ' of ' + clock(l.total) + ' · ' : ''}${ago(l.when)}`, 21, 500, 352), 16, 144);
  });
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.9 });
  kit.plane(0.38, 0.158, screenMat, 0.17, 0.22, 0.137, 0, 0, radio);
  [0.1, 0.3].forEach((x) => { kit.cyl(0.03, 0.03, 0.03, '#c9ced6', x, 0.085, 0.14, radio).rotation.x = Math.PI / 2; });
  const led = kit.ball(0.022, kit.mat('#ff4d4d', { emissive: '#ff4d4d', emissiveIntensity: 0.05 }), -0.3, 0.37, 0.14, radio);
  const aerial = kit.cyl(0.006, 0.006, 0.5, '#c9ced6', 0.3, 0.55, -0.05, radio);
  aerial.rotation.z = -0.5;

  // the cover, standing on the cabinet beside the radio
  const coverTex = kit.canvasTexture(256, 256, (g, w, h, img) => {
    g.fillStyle = '#3a4a44'; g.fillRect(0, 0, w, h);
    if (img) g.drawImage(img, 0, 0, w, h);
    else { g.fillStyle = '#8fc9a8'; g.font = `120px ${FONT}`; g.textAlign = 'center'; g.fillText('🎙', 128, 160); }
  });
  const art = kit.group(0.42, 0.845, 0.12, cab, 0.6);
  kit.rbox(0.36, 0.36, 0.02, 0.01, '#f4efe4', 0, 0.2, 0, art).rotation.x = -0.15;
  const artPlane = kit.plane(0.3, 0.3, new THREE.MeshStandardMaterial({ map: coverTex, emissiveMap: coverTex, emissive: '#ffffff', emissiveIntensity: 0.25 }), 0, 0.2, 0.012, 0, -0.15, art);

  // floating notes while it is on air
  const noteTex = kit.canvasTexture(64, 64, (g) => { g.fillStyle = '#6fd69a'; g.font = '52px serif'; g.textAlign = 'center'; g.fillText('♪', 32, 48); });
  const notes = [0, 1, 2].map((i) => {
    const m = kit.plane(0.2, 0.2, new THREE.MeshBasicMaterial({ map: noteTex, transparent: true, depthWrite: false, opacity: 0 }), 0, 0, 0.3, 0, 0, radio);
    m.userData.i = i; m.castShadow = false;
    return m;
  });

  let data = null, live = false, coverSrc = '', shownKey = '';
  const tip = () => {
    const l = data && data.last;
    if (!l) return 'Podcast radio\nNothing played yet';
    return [`Podcast radio: ${live ? 'on air' : 'last played ' + ago(l.when)}`, l.podcast, l.episode,
      `${l.action === 'play' ? 'Played' : 'Synced'}${l.device ? ' on ' + device(l.device) : ''} · ${ago(l.when)}${l.total ? ` · ${clock(l.position)} of ${clock(l.total)}` : ''}`,
      `${data.plays_week} plays this week · ${data.podcasts} podcasts followed`].join('\n');
  };
  kit.tipOn(body, tip, 'opodsync');
  kit.tipOn(art, tip, 'opodsync');

  return {
    update(d) {
      const r = d.extra && d.extra.opodsync;
      data = r && r.ok ? r : null;
      const l = data && data.last;
      live = !!(l && Date.now() / 1000 - l.when < 1200);
      const key = JSON.stringify(l && [l.podcast, l.episode, l.when, l.position]);
      if (key !== shownKey) { shownKey = key; tex.redraw(data); }
      const src = (l && l.cover) || '';
      if (src !== coverSrc) {
        coverSrc = src;
        if (!src) coverTex.redraw(null);
        else { const img = new Image(); img.onload = () => coverTex.redraw(img); img.src = src; }
      }
    },
    frame(dt, t) {
      led.material.emissiveIntensity = live ? 1.6 + 0.6 * Math.sin(t * 3) : 0.05;
      notes.forEach((n) => {
        const k = ((t * 0.35 + n.userData.i / 3) % 1);
        n.position.set(-0.1 + Math.sin(k * 6 + n.userData.i) * 0.12, 0.5 + k * 0.7, 0.05 + n.userData.i * 0.03);
        n.material.opacity = live ? Math.sin(k * Math.PI) * 0.9 : 0;
        n.lookAt(kit.camera.position);
      });
    },
  };
}
