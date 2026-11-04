// Five small props, one per service. Data from sources/nextcloud.py, bookorbit.py, freshrss.py, seerr.py and spaarpot.py.
//  - a filing cabinet whose top drawer opens as the Nextcloud storage fills
//  - a bookshelf with the three newest BookOrbit books face-out
//  - a stack of newspapers on the coffee table, one more sheet for every few hundred unread FreshRSS articles
//  - a suggestion box (Seerr) with a flag that goes up and a slip of paper per pending request
//  - a piggy bank on the kitchen shelf (Spaarpot) with a coin for every wish
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const hue = (s) => { let h = 0; for (const c of s || '?') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const tone = (s, l = 55) => `hsl(${hue(s)}, 42%, ${l}%)`;
  const ago = (iso) => { const d = Math.max(0, (Date.now() - new Date(iso)) / 86400000); return d < 1 ? 'today' : d < 2 ? 'yesterday' : `${Math.round(d)} days ago`; };
  const gb = (b) => (b / 1e9 >= 100 ? Math.round(b / 1e9) : (b / 1e9).toFixed(1)) + ' GB';
  const wrap = (g, text, x, y, max, lh, lines = 3) => {
    const words = String(text).split(/\s+/); let line = '', n = 0;
    for (const w of words) {
      if (g.measureText(line + ' ' + w).width > max && line) { g.fillText(line, x, y + n * lh); line = w; if (++n >= lines) return; } else line = (line + ' ' + w).trim();
    }
    g.fillText(line, x, y + n * lh);
  };
  const x = {};  // the latest data of each source

  // ---------- Nextcloud: the filing cabinet under the pinboard ----------
  const cab = kit.group(-11.4, 0, -2.4, undefined, Math.PI / 2);
  kit.rbox(0.9, 1.15, 0.55, 0.04, '#8d97a8', 0, 0.6, 0, cab);
  const drawers = [0, 1, 2].map((i) => {
    const d = kit.group(0, 0.24 + i * 0.37, 0.28, cab);
    kit.rbox(0.8, 0.31, 0.04, 0.02, '#a4aebf', 0, 0, 0, d);
    kit.rbox(0.22, 0.04, 0.05, 0.015, '#d8dce4', 0, 0.04, 0.04, d);
    return d;
  });
  const folders = drawers[0];
  ['#f2c94c', '#6fb3f2', '#7fd3c0', '#f39bb0', '#a98cf0'].forEach((c, i) => kit.box(0.02, 0.2, 0.3, c, -0.3 + i * 0.12, 0.2, -0.15, folders));
  const cabTex = kit.canvasTexture(256, 96, (g, w, h, n) => {
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.fillStyle = '#2b2d36';
    g.font = `800 30px ${FONT}`; g.fillText('NEXTCLOUD', w / 2, 38);
    g.font = `600 24px ${FONT}`; g.fillText(n ? `${gb(n.used)} of ${gb(n.total)}` : '…', w / 2, 72);
  });
  const cabSign = kit.plane(0.78, 0.29, new THREE.MeshStandardMaterial({ map: cabTex }), 0, 1.19, 0.0, 0, -Math.PI / 2, cab);
  kit.tipOn(cabSign, () => !x.nextcloud ? 'Nextcloud' : `Nextcloud filing cabinet\n${gb(x.nextcloud.used)} used of ${gb(x.nextcloud.total)} (${x.nextcloud.percent}%)\n${x.nextcloud.users} accounts`, 'nextcloud');
  kit.tipOn(cab.children[0], () => cabSign.userData.tip(), 'nextcloud');

  // ---------- BookOrbit: the bookshelf in the back-left corner ----------
  const shelf = kit.group(-11.55, 0, -8.1, undefined, Math.PI / 2);
  kit.rbox(1.5, 2.05, 0.05, 0.01, '#a77c52', 0, 1.02, -0.18, shelf);
  for (const sx of [-0.75, 0.75]) kit.rbox(0.05, 2.05, 0.4, 0.01, '#b98d5f', sx, 1.02, 0, shelf);
  [0.03, 0.53, 1.03, 1.53, 2.03].forEach((y) => kit.rbox(1.5, 0.05, 0.4, 0.01, '#b98d5f', 0, y, 0, shelf));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const palette = ['#d8604d', '#e0a84f', '#5f9ea0', '#6a7fd1', '#7fb069', '#b56fb5', '#e6e0d0', '#444b5c'];
  [0.055, 0.555, 1.055].forEach((base) => {
    let px = -0.68;
    while (px < 0.64) {
      const w = 0.04 + rnd() * 0.05, h = 0.26 + rnd() * 0.18;
      kit.box(w, h, 0.26, palette[Math.floor(rnd() * palette.length)], px + w / 2, base + h / 2, 0.0, shelf);
      px += w + 0.005;
    }
  });
  const covers = [-0.45, 0, 0.45].map((cx) => {
    const tex = kit.canvasTexture(130, 190, (g, w, h, b) => {
      g.fillStyle = tone(b && b.title, 38); g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(8, 8, w - 16, h - 16);
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `700 17px ${FONT}`;
      wrap(g, (b && b.title) || '…', w / 2, 52, w - 24, 21, 5);
      g.font = `500 12px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(((b && b.author) || '').slice(0, 22), w / 2, h - 16);
    });
    const m = kit.plane(0.28, 0.41, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), cx, 1.78, 0.05, 0, -0.14, shelf);
    kit.box(0.3, 0.02, 0.06, '#8a6240', cx, 1.575, 0.09, shelf);
    m.visible = false;
    return { tex, m, book: null };
  });
  covers.forEach((c) => kit.tipOn(c.m, () => !c.book ? 'BookOrbit' : `${c.book.title}\n${c.book.author}\nAdded ${ago(c.book.added)} · ${x.bookorbit.total} books in the library`, 'bookorbit'));

  // ---------- FreshRSS: newspapers on the coffee table ----------
  const papers = kit.group(6.4, 0.5, -6.2);
  const sheets = Array.from({ length: 10 }, (_, i) => {
    const s = kit.box(0.4, 0.014, 0.3, i % 2 ? '#ebe6d8' : '#f4f1e6', -0.04 + (i % 3) * 0.008, 0.007 + i * 0.014, 0.18 + (i % 2) * 0.01, papers);
    s.rotation.y = (i - 5) * 0.025; s.visible = false;
    return s;
  });
  const newsTex = kit.canvasTexture(256, 192, (g, w, h, f) => {
    g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.fillStyle = '#23252e';
    g.font = `800 34px Georgia, serif`; g.fillText('THE FEED', w / 2, 44);
    g.fillRect(16, 54, w - 32, 3);
    g.font = `700 54px ${FONT}`; g.fillText(f ? f.unread.toLocaleString('en-GB') : '…', w / 2, 118);
    g.font = `500 22px ${FONT}`; g.fillText('unread', w / 2, 150);
  });
  const news = kit.plane(0.38, 0.285, new THREE.MeshStandardMaterial({ map: newsTex }), -0.04, 0.15, 0.18, 0, -Math.PI / 2, papers);
  news.visible = false;
  kit.tipOn(news, () => !x.freshrss ? 'FreshRSS' : `FreshRSS\n${x.freshrss.unread.toLocaleString('en-GB')} unread articles\n${x.freshrss.feeds} feeds · ${x.freshrss.favourites} favourites`, 'freshrss');

  // ---------- Seerr: the suggestion box on the kitchen counter ----------
  const box = kit.group(0.6, 0.95, -8.4);
  kit.rbox(0.3, 0.3, 0.26, 0.02, '#c89b6d', 0, 0.15, 0, box);
  kit.box(0.18, 0.012, 0.03, '#3a2a1a', 0, 0.306, 0, box);
  const signTex = kit.canvasTexture(128, 64, (g, w, h) => { g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b2d36'; g.textAlign = 'center'; g.font = `800 24px ${FONT}`; g.fillText('IDEAS', w / 2, 40); });
  const boxSign = kit.plane(0.24, 0.12, new THREE.MeshStandardMaterial({ map: signTex }), 0, 0.15, 0.135, 0, 0, box);
  const flag = kit.group(0.17, 0.3, 0, box);
  kit.cyl(0.008, 0.008, 0.22, '#9aa0ad', 0, 0.11, 0, flag);
  const flagCloth = kit.box(0.12, 0.07, 0.01, '#e24b4b', 0.06, 0.2, 0, flag);
  const slips = Array.from({ length: 6 }, (_, i) => { const s = kit.box(0.1, 0.12, 0.004, '#ffffff', (i - 2.5) * 0.025, 0.36, 0, box); s.rotation.z = (i - 2.5) * 0.16; s.visible = false; return s; });
  kit.tipOn(boxSign, () => !x.seerr ? 'Seerr' : `Suggestion box (Seerr)\n${x.seerr.pending} waiting for a yes · ${x.seerr.approved + x.seerr.processing} on the way · ${x.seerr.available} done\nNewest: ${x.seerr.latest.slice(0, 3).map((r) => r.title + ' (' + r.status + ')').join(', ') || 'nothing yet'}`, 'seerr');
  kit.tipOn(box.children[0], () => boxSign.userData.tip(), 'seerr');

  // ---------- Spaarpot: the piggy bank on the kitchen shelf ----------
  const pig = kit.group(2.95, 2.13, -8.68, undefined, 0.5);
  const body = kit.ball(0.14, '#f4a3b8', 0, 0.15, 0, pig);
  body.scale.set(1.25, 1, 1);
  kit.cyl(0.05, 0.055, 0.06, '#e88aa3', 0.17, 0.14, 0, pig).rotation.z = Math.PI / 2;
  [[0.1, 0.09], [0.1, -0.09]].forEach(([ex, ez]) => { const e = kit.cyl(0.001, 0.045, 0.06, '#e88aa3', ex, 0.27, ez, pig); e.rotation.x = ez > 0 ? 0.4 : -0.4; });
  [[0.15, 0.05], [0.15, -0.05]].forEach(([ex, ez]) => kit.ball(0.014, '#2b2d36', ex, 0.2, ez * 1.1, pig).castShadow = false);
  [[0.08, 0.07], [0.08, -0.07], [-0.08, 0.07], [-0.08, -0.07]].forEach(([lx, lz]) => kit.cyl(0.028, 0.025, 0.06, '#e88aa3', lx, 0.03, lz, pig));
  kit.torus(0.03, 0.006, Math.PI * 1.5, '#e88aa3', -0.17, 0.17, 0, pig);
  kit.box(0.09, 0.008, 0.02, '#8a3a52', 0, 0.295, 0, pig);
  const coins = Array.from({ length: 6 }, (_, i) => { const c = kit.cyl(0.04, 0.04, 0.01, '#f2c94c', -0.02 + (i % 2) * 0.02, 0.005 + i * 0.011, 0.19, pig); c.visible = false; return c; });
  kit.tipOn(body, () => !x.spaarpot ? 'Spaarpot' : `Piggy bank (Spaarpot)\n${x.spaarpot.count} wishes · €${x.spaarpot.total.toFixed(0)} in all\n${x.spaarpot.items.map((i) => i.title + ' €' + i.amount.toFixed(0)).join('\n')}`, 'spaarpot');

  return {
    update(d) {
      const e = d.extra || {};
      for (const k of ['nextcloud', 'bookorbit', 'freshrss', 'seerr', 'spaarpot']) x[k] = e[k] && e[k].ok ? e[k] : null;
      const n = x.nextcloud;
      cabTex.redraw(n);
      drawers[0].position.z = 0.28 + (n ? 0.08 + 0.3 * Math.min(1, n.percent / 25) : 0);
      const b = x.bookorbit;
      covers.forEach((c, i) => { c.book = b && b.latest[i]; c.m.visible = !!c.book; c.tex.redraw(c.book); });
      const f = x.freshrss;
      const count = f ? Math.max(1, Math.min(10, 1 + Math.round(f.unread / 250))) : 0;
      sheets.forEach((s, i) => { s.visible = i < count; });
      news.visible = !!f; if (f) { news.position.y = count * 0.014 + 0.002; newsTex.redraw(f); }
      const s = x.seerr;
      flag.rotation.z = s && s.pending ? 0 : -1.4;
      slips.forEach((p, i) => { p.visible = !!s && i < s.pending; });
      const sp = x.spaarpot;
      coins.forEach((c, i) => { c.visible = !!sp && i < sp.count; });
    },
    frame(dt, t) {
      if (x.seerr && x.seerr.pending) flag.rotation.z = Math.sin(t * 3) * 0.08;
    },
  };
}
