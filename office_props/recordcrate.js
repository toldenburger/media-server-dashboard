// The record crate next to the record player, and the DJ who looks after it. Data from sources/headphones.py.
// Every album Headphones has downloaded lately stands in the crate as a sleeve (the newest leans forward with its cover showing).
// Albums that are still arriving glow and bob; while one is on its way the DJ flips through the crate. Hover for the lists,
// double-click opens Headphones. The DJ also nods along while the record player is playing (Navidrome).
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const hue = (s) => { let h = 0; for (const c of s || '?') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const ago = (iso) => { const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  const MAX = 8;

  const dj = kit.spawn('Headphones', {
    color: '#e86a8a', trim: '#ffffff', pants: '#2c2a3c', hair: '#2a2024', style: 'curly', skin: '#b8805a', extra: 'headphones', eye: '#3a2a22',
    quips: ['Digging for the good stuff', 'Fresh vinyl just landed', 'This one goes in the crate'],
  }, { at: [9.6, 7.5], face: 0 });
  dj.link = 'headphones';

  const crate = kit.group(9.6, 0, 8.45);
  crate.scale.setScalar(1.35);
  const wood = '#b8884f', dark = '#8a6030';
  kit.box(0.9, 0.04, 0.5, dark, 0, 0.09, 0, crate);
  kit.box(0.9, 0.3, 0.03, wood, 0, 0.24, 0.235, crate);
  kit.box(0.9, 0.3, 0.03, wood, 0, 0.24, -0.235, crate);
  [-0.435, 0.435].forEach((x) => kit.box(0.03, 0.3, 0.5, wood, x, 0.24, 0, crate));
  [-0.3, 0.3].forEach((x) => kit.box(0.08, 0.07, 0.5, dark, x, 0.035, 0, crate));
  kit.box(0.2, 0.04, 0.02, dark, 0, 0.3, 0.255, crate);  // handle

  const sleeves = [];
  function makeSleeve(i) {
    const pivot = kit.group(0.3 - i * 0.085, 0.12, 0.17 - i * 0.045, crate);
    const tex = kit.canvasTexture(128, 128, () => {});
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.8 });
    const front = kit.plane(0.32, 0.32, m, 0, 0.2, 0.011, 0, 0, pivot);
    const back = kit.box(0.32, 0.32, 0.012, '#2b2d36', 0, 0.2, 0, pivot);
    const s = { pivot, tex, front, back, img: null, key: '', arriving: false, i };
    pivot.visible = false;
    return s;
  }
  for (let i = 0; i < MAX; i++) sleeves.push(makeSleeve(i));

  function paint(s, a) {
    const g = s.tex.image.getContext('2d');
    g.fillStyle = `hsl(${hue(a.artist + a.title)}, 45%, 52%)`; g.fillRect(0, 0, 128, 128);
    if (s.img) g.drawImage(s.img, 0, 0, 128, 128);
    g.fillStyle = 'rgba(20,18,26,0.72)'; g.fillRect(0, 70, 128, 58);  // the name band keeps a plain cover readable
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = `700 15px ${FONT}`; g.fillText(a.title.length > 15 ? a.title.slice(0, 14) + '…' : a.title, 64, 96);
    g.font = `500 12px ${FONT}`; g.fillStyle = '#d8d4e4'; g.fillText(a.artist.length > 19 ? a.artist.slice(0, 18) + '…' : a.artist, 64, 116);
    if (a.status === 'snatched') { g.strokeStyle = '#ffd84a'; g.lineWidth = 8; g.strokeRect(0, 0, 128, 128); }
    s.tex.needsUpdate = true;
  }

  let data = null, spinning = false;
  const tip = () => {
    if (!data) return 'Record crate';
    const lines = [`Record crate (Headphones)`, `${data.downloaded} albums downloaded · ${data.arriving} on their way · ${data.wanted} wanted`];
    if (data.crate.length) lines.push('', 'Newest in the crate:', ...data.crate.slice(0, 5).map((a) => `• ${a.title} · ${a.artist}${a.status === 'snatched' ? ' (arriving)' : ''} · ${ago(a.added)}`));
    if (data.wanted_list.length) lines.push('', 'Wanted:', ...data.wanted_list.slice(0, 4).map((a) => `• ${a.title} · ${a.artist}`));
    return lines.join('\n');
  };
  kit.tipOn(crate, tip, 'headphones');

  return {
    update(d) {
      const n = d.extra && d.extra.navidrome;
      spinning = !!(n && n.ok && n.playing);
      const h = d.extra && d.extra.headphones;
      if (!h || !h.ok) { data = null; sleeves.forEach((s) => { s.pivot.visible = false; }); return; }
      data = h;
      sleeves.forEach((s, i) => {
        const a = h.crate[i];
        s.pivot.visible = !!a;
        if (!a) return;
        s.arriving = a.status === 'snatched';
        const key = JSON.stringify([a.id, a.status]);
        if (key === s.key) return;
        s.key = key; s.img = null;
        paint(s, a);
        const img = new Image();
        img.onload = () => { s.img = img; paint(s, a); };
        img.src = a.cover;
      });
    },
    frame(dt, t) {
      sleeves.forEach((s) => {
        if (!s.pivot.visible) return;
        // the newest sleeve leans forward so its cover shows, the others stand tilted back a little
        const lean = s.i === 0 ? 0.55 : 0.12;
        s.pivot.rotation.x += (lean + (s.arriving ? Math.sin(t * 3 + s.i) * 0.08 : 0) - s.pivot.rotation.x) * Math.min(1, dt * 6);
      });
      const arriving = data && data.arriving > 0;
      if (arriving) {  // flipping through the crate
        dj.shoulderR.rotation.x = -0.9 + Math.sin(t * 4.5) * 0.35;
        dj.shoulderR.rotation.z = -0.1;
        dj.elbowR.rotation.x = -0.9;
      }
      dj.root.children[0].rotation.x = arriving ? 0.12 : 0;
      if (spinning) dj.root.children[0].position.y += Math.abs(Math.sin(t * 5)) * 0.03;  // nodding along to the record player
    },
  };
}
