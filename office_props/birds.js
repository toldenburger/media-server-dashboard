// The two bird windows: the top bird of the day in the middle window, the newest rare bird of the week on the right.
// Data comes from sources/birdnet.py. Each bird is a photo card hanging from a branch outside the window.
export default function (kit) {
  const { THREE } = kit;
  const [, middle, right] = kit.windows;  // the left (kitchen) window stays free
  const CARD_W = 0.7, CARD_H = CARD_W * 440 / 320;
  const font = '"Segoe UI", system-ui, sans-serif';
  const bark = '#7a5a3c', leaf = ['#5fa36a', '#7cbf6f', '#4c8f5e'];

  function branch(x) {
    const g = kit.group(x, 0, -8.972);
    const b = kit.cyl(0.035, 0.05, 2.1, bark, 0, 2.86, 0, g);
    b.rotation.z = Math.PI / 2;
    [[-0.9, 2.8], [-0.55, 2.9], [-0.2, 2.8], [0.25, 2.9], [0.6, 2.82], [0.92, 2.88]].forEach(([dx, y], i) => {
      const l = kit.ball(0.11 + (i % 3) * 0.02, leaf[i % 3], dx, y - 0.04, 0.0, g);
      l.scale.set(1.5, 0.7, 0.5);
      l.rotation.z = (i % 2 ? 0.5 : -0.5);
    });
    return g;
  }

  function makeCard(x, side) {
    const pivot = kit.group(x + side * 0.57, 2.86, -8.968);
    [-0.2, 0.2].forEach((dx) => kit.box(0.008, 0.22, 0.008, '#8a7a66', dx, -0.11, 0, pivot));
    const tex = kit.canvasTexture(320, 440, () => {});
    const material = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.9 });
    const card = kit.plane(CARD_W, CARD_H, material, 0, -0.22 - CARD_H / 2, 0, 0, 0, pivot);
    card.visible = false;
    const frame = kit.box(CARD_W + 0.03, CARD_H + 0.03, 0.01, '#e8dcc8', 0, -0.22 - CARD_H / 2, -0.007, pivot);
    frame.visible = false;
    return { pivot, tex, card, frame, photo: null, src: '', shown: '', phase: Math.random() * 6 };
  }

  function draw(c, info) {
    const g = c.tex.image.getContext('2d');
    g.clearRect(0, 0, 320, 440);
    g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, 320, 440);
    g.fillStyle = info.accent; g.fillRect(0, 0, 320, 40);
    g.fillStyle = '#ffffff'; g.font = `700 20px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(info.ribbon, 160, 21);
    g.save();
    g.beginPath(); g.roundRect(18, 52, 284, 262, 14); g.clip();
    g.fillStyle = '#d9d2c4'; g.fillRect(18, 52, 284, 262);
    if (c.photo) {
      const k = Math.max(284 / c.photo.width, 262 / c.photo.height), w = c.photo.width * k, h = c.photo.height * k;
      g.drawImage(c.photo, 18 + (284 - w) / 2, 52 + (262 - h) / 2, w, h);
    } else { g.font = `120px ${font}`; g.fillStyle = '#a49a88'; g.fillText('🐦', 160, 185); }
    g.restore();
    g.fillStyle = '#2b2620'; g.font = `700 30px ${font}`;
    g.fillText(fitText(g, info.name, 280), 160, 345);
    g.fillStyle = '#7a7366'; g.font = `500 21px ${font}`;
    g.fillText(fitText(g, info.sub, 280), 160, 380);
    g.font = `italic 17px ${font}`; g.fillStyle = '#a49a88';
    g.fillText(fitText(g, info.latin, 280), 160, 410);
    c.tex.needsUpdate = true;
  }
  const fitText = (g, text, max) => {
    if (g.measureText(text).width <= max) return text;
    while (text.length > 1 && g.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text.trimEnd() + '…';
  };

  function show(c, info, tip) {
    const key = JSON.stringify(info);
    c.card.visible = c.frame.visible = true;
    kit.tipOn(c.card, tip);
    if (info.image !== c.src) {
      c.src = info.image; c.photo = null;
      const img = new Image();
      img.onload = () => { c.photo = img; draw(c, info); };
      img.src = info.image;
    }
    if (key !== c.shown) { c.shown = key; draw(c, info); }
  }

  branch(middle); branch(right);
  const topCard = makeCard(middle, -1), rareCard = makeCard(right, 1);

  const clock = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return {
    update(d) {
      const b = d.extra && d.extra.birdnet;
      if (!b || !b.ok) { topCard.card.visible = topCard.frame.visible = rareCard.card.visible = rareCard.frame.visible = false; return; }
      if (b.top) {
        show(topCard, { ribbon: 'BIRD OF THE DAY', accent: '#4c8f5e', name: b.top.name, sub: `heard ${b.top.count}× today`, latin: b.top.scientific, image: b.top.image },
          () => `Bird of the day: ${b.top.name}\n${b.top.scientific}\n${b.top.count} detections today · last heard ${b.top.last_heard}\n${b.species_today} species and ${b.detections_today} detections so far today`);
      }
      if (b.rare) {
        const r = b.rare, label = r.kind === 'new' ? 'NEW SPECIES' : 'RARE VISITOR';
        show(rareCard, { ribbon: r.this_week ? label : `LAST ${label}`, accent: r.this_week ? '#d9902f' : '#8f8a80', name: r.name, sub: clock(r.when), latin: r.scientific, image: r.image },
          () => `${r.this_week ? 'Newest rare bird this week' : 'Newest rare bird (none this week)'}: ${r.name}\n${r.scientific}\n${r.kind === 'new' ? 'First time heard here' : 'Infrequent visitor'} · ${clock(r.when)} · ${Math.round((r.confidence || 0) * 100)}% sure`);
      }
    },
    frame(dt, t) {
      for (const c of [topCard, rareCard]) {
        c.pivot.rotation.z = Math.sin(t * 1.1 + c.phase) * 0.045;
        c.pivot.rotation.y = Math.sin(t * 0.7 + c.phase) * 0.06;
      }
    },
  };
}
