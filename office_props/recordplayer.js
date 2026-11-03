// The record player in the front corner, seen from behind. Data from sources/navidrome.py.
// The record turns while something is playing; the stack beside it is the albums played lately, with the newest cover on top.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const hue = (s) => { let h = 0; for (const c of s || '?') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const sleeveColor = (s) => `hsl(${hue(s)}, 45%, 55%)`;
  const ago = (unix, now) => { const m = Math.max(1, Math.round((now - unix) / 60)); return m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

  // the table sits in the front corner and faces the room, so the camera looks at its back
  const rig = kit.group(11.1, 0, 8.0, undefined, -3 * Math.PI / 4);
  const wood = '#c89b6d';
  kit.rbox(1.6, 0.07, 0.85, 0.03, wood, 0, 0.75, 0, rig);
  [[-0.72, -0.37], [0.72, -0.37], [-0.72, 0.37], [0.72, 0.37]].forEach(([x, z]) => kit.box(0.06, 0.72, 0.06, '#a77c52', x, 0.36, z, rig));

  // turntable
  const player = kit.group(-0.32, 0.785, 0, rig);
  kit.rbox(0.74, 0.09, 0.6, 0.03, '#2b2d36', 0, 0.045, 0, player);
  kit.cyl(0.255, 0.255, 0.03, '#c9ccd3', 0, 0.105, 0, player, 40);
  const led = kit.ball(0.02, kit.mat('#4ade80', { emissive: '#4ade80', emissiveIntensity: 0.1 }), 0.3, 0.095, 0.24, player);
  led.castShadow = false;
  const disc = kit.group(0, 0.13, 0, player);
  kit.cyl(0.235, 0.235, 0.014, '#14141a', 0, 0, 0, disc, 48);
  [0.19, 0.15, 0.11].forEach((r) => { const g = kit.torus(r, 0.003, Math.PI * 2, '#2b2b34', 0, 0.008, 0, disc); g.rotation.x = Math.PI / 2; });
  const labelMat = new THREE.MeshStandardMaterial({ color: '#e07a5f', roughness: 0.6 });
  const label = kit.cyl(0.08, 0.08, 0.016, '#e07a5f', 0, 0.001, 0, disc, 32);
  label.material = labelMat;
  kit.ball(0.012, '#d8dce4', 0, 0.012, 0, disc);
  // tonearm: rests beside the record, swings onto it while playing
  const arm = kit.group(0.3, 0.17, -0.2, player);
  kit.cyl(0.035, 0.035, 0.06, '#9aa0ad', 0, -0.02, 0, arm);
  const bar = kit.box(0.018, 0.016, 0.4, '#d8dce4', 0, 0, 0.2, arm);
  kit.box(0.05, 0.02, 0.07, '#2b2d36', 0, 0, 0.4, arm);
  bar.userData.noOutline = true;

  // the stack of albums played lately; the top sleeve shows the newest cover, upright for the camera
  const stack = kit.group(0.5, 0.785, 0, rig, Math.PI);
  const sleeves = Array.from({ length: 6 }, (_, i) => {
    const s = kit.box(0.42, 0.012, 0.42, '#888', 0, 0.006 + i * 0.013, 0, stack);
    s.material = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.8 });
    s.rotation.y = (i % 2 ? 1 : -1) * (0.04 + i * 0.015);
    s.visible = false;
    return s;
  });
  const coverTex = kit.canvasTexture(256, 256, (g, w, h, c) => {
    const base = sleeveColor(c && c.album);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (c && c.image) {
      const k = Math.max(w / c.image.width, h / c.image.height);
      g.drawImage(c.image, (w - c.image.width * k) / 2, (h - c.image.height * k) / 2, c.image.width * k, c.image.height * k);
      return;
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 90, w, 90);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 26px ${FONT}`; g.fillText(fit(g, (c && c.album) || 'Record', w - 24), w / 2, h - 58);
    g.font = `500 20px ${FONT}`; g.fillText(fit(g, (c && c.artist) || '', w - 24), w / 2, h - 28);
    g.font = '90px serif'; g.fillText('♪', w / 2, 80);
  });
  function fit(g, text, max) { while (text.length > 1 && g.measureText(text).width > max) text = text.slice(0, -1); return text; }
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7 });
  const top = kit.plane(0.4, 0.4, coverMat, 0, 0.0, 0, 0, -Math.PI / 2, stack);
  top.visible = false;

  let data = null, shownCover = '', playing = false;
  const tip = () => {
    if (!data || !data.last) return 'Record player\nNothing played lately';
    const l = data.last;
    return [`Record player: ${data.playing ? 'now spinning' : 'last played ' + ago(l.when, data.now)}`, `${l.album}`, `${l.artist} · ${l.title}${l.who ? ' (' + l.who + ')' : ''}`, '', 'Recent albums:', ...data.stack.map((s, i) => `${i + 1}. ${s.album} · ${s.artist} · ${ago(s.when, data.now)}`)].join('\n');
  };
  kit.tipOn(top, tip);
  kit.tipOn(player.children[0], tip);

  return {
    update(d) {
      const n = d.extra && d.extra.navidrome;
      if (!n || !n.ok || !n.stack.length) { top.visible = false; sleeves.forEach((s) => { s.visible = false; }); return; }
      data = n; playing = n.playing;
      n.stack.slice().reverse().forEach((item, k) => {
        const i = sleeves.length - n.stack.length + k;
        if (i < 0) return;
        sleeves[i].visible = true;
        sleeves[i].material.color.set(sleeveColor(item.album));
      });
      const newest = n.stack[0];
      sleeves.forEach((s, i) => { if (i < sleeves.length - n.stack.length) s.visible = false; });
      const topY = 0.006 + (n.stack.length - 1) * 0.013 + 0.0065;
      top.position.y = topY; top.visible = true;
      labelMat.color.set(sleeveColor(newest.album));
      const key = newest.album_id;
      if (key !== shownCover) {
        shownCover = key;
        coverTex.redraw({ album: newest.album, artist: newest.artist });
        const img = new Image();
        img.onload = () => coverTex.redraw({ album: newest.album, artist: newest.artist, image: img });
        img.src = newest.cover;
      }
      led.material.emissiveIntensity = playing ? 2 : 0.1;
    },
    frame(dt) {
      if (playing) disc.rotation.y -= dt * 3.4;
      arm.rotation.y += ((playing ? -0.55 : 0.25) - arm.rotation.y) * Math.min(1, dt * 2);
    },
  };
}
