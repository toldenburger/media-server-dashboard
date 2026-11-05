// A pixelated tree on a grass patch beside the office, with a bird feeder in front of it.
// The busiest species of the day (sources/birdnet.py, "flock") sit in the tree as little pixel birds, the two busiest at the feeder.
// Hover a bird for its name and count. Everything is made of cubes.
export default function (kit) {
  const { THREE } = kit;
  const TX = 18.4, TZ = -6.6;  // the tree's spot, just outside the right edge of the room
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rand = rng(11);

  // grass patch, drawn with big square pixels
  const grass = kit.canvasTexture(32, 32, (g) => {
    const r = rng(5);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = r();
      g.fillStyle = v < 0.55 ? '#6fb85a' : v < 0.85 ? '#63ab50' : '#7cc565';
      g.fillRect(x, y, 1, 1);
    }
  });
  grass.magFilter = THREE.NearestFilter; grass.minFilter = THREE.NearestFilter;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(15, 19);
  const gx = 18.3, gz = -4.4, GW = 11.8, GD = 14.0;
  kit.box(GW, 0.8, GD, '#8a6a4a', gx, -0.4, gz).castShadow = false;
  kit.plane(GW, GD, new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), gx, 0.003, gz, 0, -Math.PI / 2);
  kit.box(GW + 0.1, 0.08, GD + 0.1, '#7a5c3e', gx, -0.82, gz).castShadow = false;

  const tree = kit.group(TX, 0, TZ);
  const U = 0.4;  // one tree pixel

  // trunk and canopy as instanced cubes
  const cubes = [];  // [x, y, z, size, color]
  const trunk = ['#6b4a2e', '#7a5636', '#5c3f27'];
  for (let y = 0; y < 3.0; y += U) {
    const flare = y < 0.5 ? 1 : 0;
    for (let x = -U * (0.5 + flare); x < U * (1 + flare); x += U) for (let z = -U * (0.5 + flare); z < U * (1 + flare); z += U) cubes.push([x, y + U / 2, z, U, trunk[Math.floor(rand() * 3)]]);
  }
  const branches = [  // [from x, y, to x, y, z]: a branch is a short staircase of cubes, kept below the leaves so the birds on it show
    [0.2, 1.7, 2.4, 2.3, 0.9], [0.2, 2.1, 0.6, 2.7, 2.4], [-0.2, 2.0, -2.4, 2.6, 0.5],
  ];
  const onBranch = (i, f) => { const [x0, y0, x1, y1, z1] = branches[i]; return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + 0.11, z1 * f]; };
  branches.forEach(([x0, y0, x1, y1, z1]) => {
    const n = 5;
    for (let i = 0; i <= n; i++) cubes.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z1 * i / n, 0.22, trunk[i % 3]]);
  });
  const leaf = ['#2f7a45', '#3f8f4f', '#4fa35a', '#66b86a'];
  const filled = new Map();  // "ix,iz" -> top y of the canopy, to set birds on top of it
  const C = { x: 0.2, y: 5.1, z: 0 }, R = { x: 2.6, y: 1.9, z: 2.3 };
  for (let ix = -8; ix <= 8; ix++) for (let iy = -6; iy <= 6; iy++) for (let iz = -8; iz <= 8; iz++) {
    const x = ix * U, y = iy * U, z = iz * U;
    const d = (x / R.x) ** 2 + (y / R.y) ** 2 + (z / R.z) ** 2 + (rand() - 0.5) * 0.35;
    if (d > 1) continue;
    const top = (y + R.y) / (2 * R.y);
    const shade = Math.min(3, Math.max(0, Math.floor(top * 3.2 + (rand() - 0.5) * 1.4 + 0.4)));
    cubes.push([C.x + x, C.y + y, C.z + z, U, leaf[shade]]);
    const k = `${ix},${iz}`;
    filled.set(k, Math.max(filled.get(k) || -9, C.y + y + U / 2));
  }
  const topAt = (x, z) => filled.get(`${Math.round((x - C.x) / U)},${Math.round((z - C.z) / U)}`) || 0;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), cubes.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  cubes.forEach(([x, y, z, s, c], i) => {
    m4.makeScale(s, s, s).setPosition(x, y, z);
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, col.set(c));
  });
  mesh.castShadow = false; mesh.receiveShadow = false;
  tree.add(mesh);

  // the feeder, in front of the tree: a post with a flat platform (towards the camera)
  const feeder = kit.group(-2.1, 0, 3.3, tree);
  kit.box(0.14, 1.3, 0.14, '#6b4a2e', 0, 0.65, 0, feeder);
  kit.box(1.2, 0.06, 0.8, '#b08a5a', 0, 1.33, 0, feeder);  // an open platform, nothing above it
  [[0, 0.37, 1.2, 0.04], [0, -0.37, 1.2, 0.04]].forEach(([x, z, w, d]) => kit.box(w, 0.05, d, '#8a6a44', x, 1.38, z, feeder));
  [[-0.5, '#e0b94a'], [-0.3, '#8a5a30'], [0.2, '#e0b94a'], [0.45, '#8a5a30']].forEach(([x, c]) => kit.box(0.09, 0.04, 0.09, c, x, 1.38, 0.1 * Math.sign(x || 1), feeder));
  // flowers in the grass
  const fr = rng(3);
  for (let i = 0; i < 9; i++) {
    const x = -3.6 + fr() * 7.2, z = -3 + fr() * 6.6;
    if (Math.hypot(x + 2.1, z - 3.3) < 1) continue;
    kit.box(0.05, 0.16, 0.05, '#4a9a48', x, 0.08, z, tree);
    kit.box(0.14, 0.12, 0.14, ['#f27a9a', '#ffd84a', '#ffffff', '#9a7af2'][i % 4], x, 0.2, z, tree);
  }

  const PERCH = [  // where birds sit, in the tree's own coordinates: feeder tray first, then the branches, then the canopy
    () => [-2.1 - 0.4, 1.36, 3.3 + 0.05], () => [-2.1 + 0.4, 1.36, 3.3 + 0.05],
    () => onBranch(0, 1), () => onBranch(1, 1), () => onBranch(2, 1),
    () => [0.4, topAt(0.4, 0.4), 0.4], () => [-1.0, topAt(-1.0, -0.4), -0.4], () => [1.7, topAt(1.7, 0.8), 0.8],
    () => onBranch(0, 0.55),
  ];

  // species colours; anything unknown gets a colour from its name
  const LOOKS = [
    [/robin|roodborst/i, { back: '#8a6a4a', belly: '#ee7b30', head: '#e0883a', wing: '#6e5238', tail: '#6e5238', beak: '#2b2b2b' }],
    [/blue tit|pimpelmees/i, { back: '#6a9ad8', belly: '#f2d94a', head: '#f4f4f4', cap: '#3f6fc0', wing: '#4a78bf', tail: '#4a78bf', beak: '#2b2b2b' }],
    [/great tit|koolmees|mees|tit\b/i, { back: '#8fa06a', belly: '#f0d640', head: '#1c1c22', wing: '#6f7f9a', tail: '#6f7f9a', beak: '#2b2b2b' }],
    [/blackbird|merel/i, { back: '#1e1e24', belly: '#26262d', head: '#1e1e24', wing: '#15151a', tail: '#15151a', beak: '#f0a020' }],
    [/sparrow|mus\b|huismus|heggenmus/i, { back: '#8a6a48', belly: '#cfc4b0', head: '#9a9a9a', cap: '#8b5a3a', wing: '#6e5238', tail: '#6e5238', beak: '#5a4a3a' }],
    [/magpie|ekster/i, { back: '#1e1e28', belly: '#f4f4f4', head: '#1e1e28', wing: '#2a5a8a', tail: '#2a5a8a', beak: '#1c1c22' }],
    [/dove|pigeon|duif/i, { back: '#9aa2b0', belly: '#b8bfcc', head: '#8890a0', wing: '#7c8494', tail: '#7c8494', beak: '#d0a0a0' }],
    [/goldfinch|putter/i, { back: '#b08a5a', belly: '#f4f0e8', head: '#d83030', wing: '#2a2a2a', tail: '#2a2a2a', beak: '#f0d0b0' }],
    [/finch|vink/i, { back: '#9a7a5a', belly: '#e0a0a0', head: '#7a9ab0', wing: '#5a5a60', tail: '#5a5a60', beak: '#c8b8a0' }],
    [/starling|spreeuw/i, { back: '#2e2e44', belly: '#3a3a55', head: '#2e2e44', wing: '#4a4a66', tail: '#2e2e44', beak: '#e8c840' }],
    [/crow|rook|jackdaw|raven|kraai|roek|kauw|raaf/i, { back: '#202026', belly: '#2a2a30', head: '#202026', wing: '#16161a', tail: '#16161a', beak: '#444444' }],
    [/thrush|fieldfare|kramsvogel|lijster/i, { back: '#7a6048', belly: '#e8d8b8', head: '#8a8f9a', wing: '#5a4630', tail: '#3a2e22', beak: '#e8b030' }],
    [/jay|gaai/i, { back: '#b08a78', belly: '#d8b8a8', head: '#c8a898', wing: '#3a7ad0', tail: '#2a3a50', beak: '#2b2b2b' }],
    [/wren|winterkoning/i, { back: '#8a5f3a', belly: '#b08a60', head: '#8a5f3a', wing: '#6a4a2a', tail: '#6a4a2a', beak: '#4a3a2a' }],
  ];
  const lookOf = (name) => {
    const hit = LOOKS.find(([re]) => re.test(name));
    if (hit) return hit[1];
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return { back: `hsl(${h},45%,45%)`, belly: `hsl(${h},35%,78%)`, head: `hsl(${h},50%,38%)`, wing: `hsl(${h},40%,30%)`, tail: `hsl(${h},40%,30%)`, beak: '#e8a23a' };
  };

  // one pixel bird, feet on the origin, facing +x
  function makeBird(look, parent) {
    const g = kit.group(0, 0, 0, parent);
    const s = kit.group(0, 0, 0, g); s.scale.setScalar(1.8);
    [-0.04, 0.04].forEach((z) => kit.box(0.02, 0.09, 0.02, '#6b5a4a', 0.02, 0.045, z, s));
    kit.box(0.34, 0.2, 0.22, look.back, 0, 0.2, 0, s);
    kit.box(0.28, 0.1, 0.23, look.belly, 0.03, 0.15, 0, s);
    kit.box(0.2, 0.12, 0.25, look.wing, -0.03, 0.22, 0, s);
    const tail = kit.group(-0.17, 0.24, 0, s); tail.rotation.z = -0.3;
    kit.box(0.22, 0.05, 0.12, look.tail, -0.11, 0, 0, tail);
    const head = kit.group(0.13, 0.3, 0, s);
    kit.box(0.2, 0.2, 0.2, look.head, 0.07, 0.07, 0, head);
    if (look.cap) kit.box(0.2, 0.05, 0.205, look.cap, 0.07, 0.15, 0, head);
    kit.box(0.07, 0.05, 0.06, look.beak, 0.2, 0.06, 0, head);
    [-0.1, 0.1].forEach((z) => kit.box(0.035, 0.035, 0.02, '#111111', 0.12, 0.1, z, head));
    return { g, head, tail };
  }

  let birds = [], shownKey = '', latest = '';
  const clockOf = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'earlier');

  // the rare visitor of the week is gold, with a soft glow; it takes the place of its species in the flock, or the top of the tree
  const GOLD = { back: '#f2c230', belly: '#ffe27a', head: '#f7d44a', cap: '#e8a820', wing: '#c9971c', tail: '#c9971c', beak: '#e0762a' };
  const haloTex = kit.canvasTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,225,110,0.9)'); gr.addColorStop(1, 'rgba(255,225,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const RARE_PERCH = () => [-0.2, topAt(-0.2, 0.9), 0.9];

  function rebuild(flock, rare) {
    birds.forEach((b) => tree.remove(b.g));
    const spots = flock.slice(0, PERCH.length).map((f, i) => ({ f, pos: PERCH[i](), i, gold: !!rare && f.name === rare.name }));
    if (rare && !spots.some((x) => x.gold)) spots.push({ f: { name: rare.name, scientific: rare.scientific, count: 0 }, pos: RARE_PERCH(), i: spots.length, gold: true });
    birds = spots.map(({ f, pos, i, gold }) => {
      const parts = makeBird(gold ? GOLD : lookOf(f.name), tree);
      parts.g.position.set(pos[0], pos[1], pos[2]);
      const baseY = pos[1], phase = rand() * 6;
      parts.g.rotation.y = i % 2 ? Math.PI : 0.5;
      let halo = null;
      if (gold) {
        halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.setScalar(1.3); halo.position.set(0, 0.4, 0);
        parts.g.add(halo);
      }
      const where = i < 2 && !gold ? 'At the feeder' : 'In the tree';
      kit.tipOn(parts.g, () => gold
        ? `${rare.kind === 'new' ? 'New species' : 'Rare visitor'} this week: ${rare.name}\n${rare.scientific}\n${rare.kind === 'new' ? 'First time heard here' : 'Infrequent visitor'} · ${clockOf(rare.when)} · ${Math.round((rare.confidence || 0) * 100)}% sure`
        : `${f.name}\n${f.scientific}\nheard ${f.count}× today · last ${f.last_heard || 'earlier'}\n${where}`, 'birdnet');
      return { ...parts, f, i, baseY, phase, halo, hop: -9, nextHop: 3 + rand() * 8, face: parts.g.rotation.y, feeder: i < 2 && !gold };
    });
  }

  kit.tipOn(feeder, () => 'Bird feeder\nThe busiest birds of the day eat here, the others sit in the tree', 'birdnet');

  kit.extendView([[gx + GW / 2, -0.85, gz - GD / 2], [gx + GW / 2, -0.85, gz + GD / 2], [TX, 7.9, TZ], [TX - 3, 7.9, TZ], [TX + 3, 7.9, TZ]]);

  return {
    update(d) {
      const b = d.extra && d.extra.birdnet;
      const flock = (b && b.ok && (b.flock || (b.top ? [{ name: b.top.name, scientific: b.top.scientific, count: b.top.count, last_heard: b.top.last_heard }] : []))) || [];
      const rare = b && b.ok && b.rare && b.rare.this_week ? b.rare : null;
      const key = JSON.stringify([flock.map((f) => [f.name, f.count]), rare && [rare.name, rare.when]]);
      if (key !== shownKey) { shownKey = key; rebuild(flock, rare); }
      const now = b && b.latest && b.latest.name;
      if (now && now !== latest) {  // the bird that was just heard hops
        if (latest) { const hit = birds.find((x) => x.f.name === now); if (hit) hit.hop = -0.0001; }
        latest = now;
      }
    },
    frame(dt, t) {
      birds.forEach((b) => {
        b.tail.rotation.z = -0.3 + Math.sin(t * 2 + b.phase) * 0.05;
        if (b.halo) b.halo.material.opacity = 0.55 + 0.35 * Math.sin(t * 2.2);
        if (b.feeder) b.head.rotation.z = -0.55 * Math.max(0, Math.sin(t * 2.4 + b.phase)) ** 6;
        else b.head.rotation.y = Math.sin(t * 0.7 + b.phase) > 0.85 ? Math.sin(t * 6) * 0.5 : 0;
        if (b.hop < -1 && t > b.nextHop) { b.hop = t; b.nextHop = t + 6 + rand() * 12; if (rand() < 0.5) b.face += Math.PI; }
        if (b.hop === -0.0001) b.hop = t;
        if (b.hop >= 0) {
          const k = (t - b.hop) / 0.35;
          if (k >= 1) { b.hop = -9; b.g.position.y = b.baseY; }
          else b.g.position.y = b.baseY + Math.sin(k * Math.PI) * 0.3;
        }
        b.g.rotation.y += (b.face - b.g.rotation.y) * Math.min(1, dt * 8);
      });
    },
  };
}
