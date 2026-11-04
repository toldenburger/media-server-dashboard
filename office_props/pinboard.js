// The cork pinboard on the left wall, with one note per saved Linkwarden link, and the librarian who pins them.
// When a new link shows up in Linkwarden (added in the app or sent from your phone) the librarian walks to the board and pins a note.
// Data from sources/linkwarden.py. Hover the board for the latest links, double-click opens Linkwarden.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const BW = 4.8, BH = 2.3, BY = 1.85, BZ = -1.75, WALL = -11.92;  // board size and where it hangs
  const CW = 1920, CH = 920, SLOTS = 14, COLS = 5;
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const PAPER = ['#fff3a8', '#ffd1dc', '#c9ecff', '#d4f5c0', '#ffe0b3', '#e6d5ff'];
  const slotOf = (id) => id % SLOTS;
  const slotXY = (s) => [70 + (s % COLS) * 372 + ((s * 37) % 23), 45 + Math.floor(s / COLS) * 295 + ((s * 53) % 19)];

  let shown = new Map();  // slot -> note currently pinned there
  const wrap = (g, text, max, lines) => {
    const words = text.split(/\s+/), out = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (g.measureText(next).width > max && line) { out.push(line); line = w; } else line = next;
    }
    if (line) out.push(line);
    if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '…'); }
    return out;
  };
  const tex = kit.canvasTexture(CW, CH, (g, w, h) => {
    g.fillStyle = '#c99660'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 9000; i++) {
      const v = r();
      g.fillStyle = v < 0.4 ? 'rgba(120,76,36,0.35)' : v < 0.75 ? 'rgba(232,190,140,0.45)' : 'rgba(90,56,26,0.3)';
      g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3.2, 0, 7); g.fill();
    }
    for (const [s, n] of shown) {
      const [x, y] = slotXY(s), rr = rng(n.id), tilt = (rr() - 0.5) * 0.12;
      g.save();
      g.translate(x + 150, y + 115); g.rotate(tilt);
      g.shadowColor = 'rgba(40,20,0,0.4)'; g.shadowBlur = 14; g.shadowOffsetY = 8;
      g.fillStyle = PAPER[n.id % PAPER.length]; g.fillRect(-150, -115, 300, 230);
      g.shadowColor = 'transparent';
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(-150, -115, 300, 34);
      g.fillStyle = '#2b2620'; g.font = `600 31px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      wrap(g, n.title, 262, 4).forEach((line, i) => g.fillText(line, -132, -52 + i * 37));
      g.fillStyle = '#6f6759'; g.font = `500 23px ${FONT}`;
      g.fillText(n.host.slice(0, 26), -132, 97);
      const pin = ['#e04848', '#3f7fe0', '#e0a63f', '#3fae7a'][n.id % 4];
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(3, -92, 17, 0, 7); g.fill();
      g.fillStyle = pin; g.beginPath(); g.arc(0, -97, 16, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-5, -103, 5, 0, 7); g.fill();
      g.restore();
    }
  });
  tex.anisotropy = 16;
  kit.rbox(0.08, BH + 0.2, BW + 0.2, 0.03, '#7a5a38', -11.97, BY, BZ);
  const board = kit.plane(BW, BH, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), WALL, BY, BZ, Math.PI / 2);

  // the librarian, with a little book cart beside the board
  const HOME = [-10.3, -0.4];
  const librarian = kit.spawn('Linkwarden', {
    color: '#8a6fbf', trim: '#ffffff', pants: '#3a3550', hair: '#6b4a3a', style: 'bun', skin: '#e0b090', extra: 'glasses', eye: '#4a3a30',
    quips: ['Filing the latest finds', 'Another link for the board', 'Shh, reading'],
  }, { at: HOME, face: -Math.PI / 2 });
  librarian.link = 'linkwarden';
  const cart = kit.group(-11.2, 0, 0.7, undefined, Math.PI / 2);
  kit.box(0.9, 0.04, 0.5, '#8a6a44', 0, 0.55, 0, cart);
  kit.box(0.9, 0.04, 0.5, '#8a6a44', 0, 0.25, 0, cart);
  [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]].forEach(([x, z]) => kit.box(0.04, 0.55, 0.04, '#6b4a2e', x, 0.28, z, cart));
  [[-0.25, '#e05d5d', 0.18], [-0.1, '#4f86e0', 0.24], [0.05, '#3fae7a', 0.2], [0.22, '#e0a63f', 0.26], [0.34, '#9a7af2', 0.2]].forEach(([x, c, hgt]) => kit.box(0.1, hgt, 0.3, c, x, 0.57 + hgt / 2, 0, cart));
  [-0.3, 0.1].forEach((x, i) => kit.box(0.34, 0.07, 0.4, ['#c0643c', '#5a8fd0'][i], x, 0.29, 0, cart));
  [-0.4, 0.4].forEach((x) => kit.cyl(0.05, 0.05, 0.03, '#2a2a33', x, 0.06, 0.26, cart).rotation.x = Math.PI / 2);

  let notes = [], known = null, queue = [], phase = 'idle', since = 0, current = null;
  const worldZ = (slot) => BZ + BW / 2 - (slotXY(slot)[0] + 150) / CW * BW;
  const draw = () => tex.redraw();
  // the Nextcloud filing cabinet stands under the board (z -2.85 to -1.95): stand beside it, not inside it
  const standZ = (z) => (z > -3.1 && z < -1.7 ? (z < -2.4 ? -3.1 : -1.7) : z);

  kit.tipOn(board, () => notes.length
    ? `Linkwarden pinboard\n${notes.slice(0, 6).map((n) => '• ' + (n.title.length > 54 ? n.title.slice(0, 53) + '…' : n.title)).join('\n')}\n${shown.size} notes pinned`
    : 'Linkwarden pinboard\nNothing pinned yet', 'linkwarden');

  return {
    update(d) {
      const lw = d.extra && d.extra.linkwarden;
      if (!lw || !lw.ok) return;
      notes = lw.notes || [];
      const ids = new Set(notes.map((n) => n.id));
      if (known === null) {  // first look: the board is already full
        known = ids;
        shown = new Map(notes.slice(0, SLOTS).map((n) => [slotOf(n.id), n]));
        draw();
        return;
      }
      for (const n of [...notes].reverse()) {
        if (known.has(n.id)) continue;
        known.add(n.id);
        if (queue.length < 3) queue.push(n); else { shown.set(slotOf(n.id), n); draw(); }
      }
    },
    frame(dt, t) {
      const p = librarian;
      const arrived = !p.path.length && p.pose;
      if (phase === 'idle' && queue.length && arrived) {
        current = queue.shift();
        const z = standZ(worldZ(slotOf(current.id)));
        kit.go(p, [[-10.2, z], [-11.1, z]], { at: [-11.1, z], face: -Math.PI / 2 });
        phase = 'walk';
      } else if (phase === 'walk' && arrived) { phase = 'pin'; since = t; }
      else if (phase === 'pin') {
        const k = t - since;
        p.shoulderR.rotation.x = -1.6 + Math.sin(k * 6) * 0.06;
        p.shoulderR.rotation.z = -0.15;
        p.elbowR.rotation.x = -0.5;
        if (k > 1.0 && current) { shown.set(slotOf(current.id), current); current = null; draw(); }
        if (k > 2.0) { kit.go(p, [[-10.2, p.root.position.z], HOME], { at: HOME, face: -Math.PI / 2 }); phase = 'back'; }
      } else if (phase === 'back' && arrived) phase = 'idle';
    },
  };
}
