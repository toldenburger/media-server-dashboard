// The server room crew. Data from sources/docker.py, tailscale.py, cloudflared.py and backups.py.
//  - the Docker engineer tends a yard of little crates, one per container (grey = not running, red = unhealthy)
//  - the Tailscale operator works a switchboard of lights and a desk of little devices, one per online device
//  - Cloudflared is a fax machine that prints a page whenever the tunnel handles a request
//  - the backups are a vault hatch in the floor with a screen showing the last backup
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif', FY = 0.08;  // FY: the server room floor
  const glow = (color, k = 1.2) => kit.mat(color, { emissive: color, emissiveIntensity: k });
  const ago = (sec) => { const m = Math.round(sec / 60); return m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  const hhmm = (unix) => new Date(unix * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ---------- Docker: the engineer and the container yard ----------
  const engineer = kit.spawn('Docker', {
    color: '#f28c3a', trim: '#ffffff', pants: '#2f3a52', hair: '#3b2a20', style: 'short', skin: '#e8b994', extra: 'cap', eye: '#3f7fbf',
    quips: ['Containers all tidy', 'Have you tried restarting it?', 'docker ps, again'],
  }, { at: [-9.3, 7.3], face: -Math.PI / 2 });
  const crates = [];
  const crateColors = ['#4fa3e0', '#e0a84f', '#6fc08b', '#c27ad6', '#e07a5f'];
  const yard = kit.group(-8.95, FY, 8.55);
  for (let i = 0; i < 50; i++) {
    const c = kit.box(0.2, 0.11, 0.13, '#888', (i % 10) * 0.23 - 1.03, 0.055, Math.floor(i / 10) * 0.17 - 0.34, yard);
    c.material = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.6 });
    c.visible = false;
    crates.push(c);
  }
  let dock = null;

  // ---------- Tailscale: switchboard and devices ----------
  const operator = kit.spawn('Tailscale', {
    color: '#7c5cff', trim: '#ffffff', pants: '#2c2c3a', hair: '#2b2b38', style: 'bun', skin: '#c98e6a', extra: 'headphones', eye: '#3a2a4a',
    quips: ['Connecting you now…', 'Please hold', 'Everyone is on the line'],
  }, { at: [-8.2, 6.5], face: Math.PI });
  const boardTex = kit.canvasTexture(512, 256, (g, w, h, t) => {
    g.fillStyle = '#1d1f2b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9aa0b4'; g.font = `700 26px ${FONT}`; g.textAlign = 'left';
    g.fillText(t ? `TAILNET  ${t.online}/${t.total} online` : 'TAILNET', 22, 40);
    const devices = t ? t.devices : [];
    for (let i = 0; i < 40; i++) {
      const d = devices[i], x = 40 + (i % 10) * 47, y = 85 + Math.floor(i / 10) * 40;
      g.beginPath(); g.arc(x, y, 14, 0, 7);
      g.fillStyle = !d ? '#2a2d3b' : !d.online ? '#4a3036' : d.active ? '#5ef2ff' : '#4ade80';
      if (d && d.online) { g.shadowColor = g.fillStyle; g.shadowBlur = 14; }
      g.fill(); g.shadowBlur = 0;
    }
  });
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, emissiveMap: boardTex, emissive: '#ffffff', emissiveIntensity: 0.75 });
  kit.rbox(2.5, 1.3, 0.08, 0.04, '#3a3f4f', -8.2, FY + 1.55, 5.3);
  kit.plane(2.34, 1.17, boardMat, -8.2, FY + 1.55, 5.345);
  kit.rbox(2.5, 0.06, 0.7, 0.02, '#d9c9b0', -8.2, FY + 0.78, 5.85);
  [-1.15, 1.15].forEach((dx) => { kit.box(0.06, 0.74, 0.6, '#b8a88e', -8.2 + dx, FY + 0.37, 5.85); });
  const devices = [];
  const deskDevice = (i) => {
    const g = kit.group(-9.2 + (i % 8) * 0.3, FY + 0.81, 5.72 + Math.floor(i / 8) * 0.3);
    const base = kit.box(0.24, 0.015, 0.17, '#c9ccd3', 0, 0.008, 0, g);
    const screen = kit.box(0.24, 0.16, 0.012, '#1c1e27', 0, 0.09, -0.08, g);
    screen.rotation.x = -0.2;
    screen.material = new THREE.MeshStandardMaterial({ color: '#1c1e27', emissive: '#4ade80', emissiveIntensity: 0.6 });
    return { g, base, screen };
  };
  for (let i = 0; i < 16; i++) devices.push(deskDevice(i));
  let tail = null;

  // ---------- Cloudflared: the fax machine ----------
  const fax = kit.group(-5.75, FY, 6.6, undefined, -0.35);
  kit.box(1.0, 0.78, 0.7, '#c9b99f', 0, 0.39, 0, fax);
  kit.rbox(0.62, 0.2, 0.46, 0.05, '#ebe7de', 0, 0.88, 0, fax);
  kit.rbox(0.44, 0.03, 0.34, 0.01, '#ffffff', 0, 1.0, -0.06, fax).rotation.x = -0.35;
  kit.box(0.3, 0.02, 0.012, '#2a2c35', 0, 0.9, 0.235, fax);
  const faxLed = kit.ball(0.03, glow('#4ade80', 2), 0.22, 0.99, 0.2, fax);
  faxLed.castShadow = false;
  const sheets = Array.from({ length: 4 }, () => { const s = kit.plane(0.3, 0.4, new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide }), 0, 0.9, 0.3, 0, -Math.PI / 2, fax); s.visible = false; return s; });
  const faxPile = kit.box(0.34, 0.02, 0.42, '#f4f4f0', 0.78, 0.02, 0.3, fax);
  const flying = [];
  let tunnel = null;

  // ---------- Backups: the vault hatch ----------
  const vault = kit.group(-6.3, FY, 7.9);
  kit.cyl(0.78, 0.78, 0.05, '#4b5160', 0, 0.025, 0, vault, 40);
  kit.cyl(0.66, 0.66, 0.07, '#9aa0ad', 0, 0.05, 0, vault, 40);
  const ring = kit.torus(0.7, 0.035, Math.PI * 2, '#4ade80', 0, 0.09, 0, vault);
  ring.rotation.x = Math.PI / 2;
  ring.material = glow('#4ade80', 1.4);
  const wheel = kit.group(0, 0.12, 0, vault);
  kit.torus(0.3, 0.03, Math.PI * 2, '#d8dce4', 0, 0, 0, wheel).rotation.x = Math.PI / 2;
  for (let k = 0; k < 3; k++) { const spoke = kit.box(0.6, 0.03, 0.03, '#d8dce4', 0, 0, 0, wheel); spoke.rotation.y = k * Math.PI / 3; }
  kit.ball(0.07, '#d8dce4', 0, 0, 0, wheel);
  const signTex = kit.canvasTexture(384, 192, (g, w, h, b) => {
    g.fillStyle = '#1d1f2b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c94c'; g.font = `800 25px ${FONT}`; g.textAlign = 'left'; g.fillText('BASEMENT VAULT', 18, 38);
    if (!b) { g.fillStyle = '#9aa0b4'; g.font = `600 22px ${FONT}`; g.fillText('checking…', 18, 90); return; }
    g.fillStyle = b.ok ? '#4ade80' : '#ff6b6b'; g.font = `800 54px ${FONT}`;
    g.fillText(b.last_ok ? hhmm(b.last_ok) : '--:--', 18, 102);
    g.fillStyle = '#9aa0b4'; g.font = `500 22px ${FONT}`;
    g.fillText(b.last_ok ? `last backup · ${ago(b.now - b.last_ok)}` : 'no backup yet', 18, 132);
    g.font = `600 21px ${FONT}`;
    b.jobs.slice(0, 4).forEach((j, i) => { g.fillStyle = j.running ? '#5ef2ff' : j.ok ? '#4ade80' : '#ff6b6b'; g.fillText(`${j.ok ? '✓' : '✗'} ${j.name}`, 18 + (i % 2) * 180, 160 + Math.floor(i / 2) * 26); });
  });
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: '#ffffff', emissiveIntensity: 0.6 });
  const sign = kit.group(-6.3, FY, 8.75, undefined, 0.5);
  kit.box(0.05, 0.4, 0.05, '#9aa0ad', 0, 0.2, 0, sign);
  kit.rbox(0.9, 0.46, 0.04, 0.02, '#3a3f4f', 0, 0.62, 0, sign).rotation.x = -0.25;
  const signPlane = kit.plane(0.84, 0.42, signMat, 0, 0.625, 0.025, 0, -0.25, sign);
  let backup = null;

  // hover text
  engineer.say = () => !dock ? 'Docker\nCounting containers…' : `Docker engineer\n${dock.running} running · ${dock.created} created · ${dock.exited} stopped\n${dock.restarting.length + dock.unhealthy.length ? '⚠ needs attention: ' + [...dock.restarting, ...dock.unhealthy].join(', ') : dock.recently_changed ? 'Something just changed, checking it out' : 'All quiet'}\nNot running: ${dock.stopped.slice(0, 6).join(', ') || 'none'}`;
  operator.say = () => !tail ? 'Tailscale\nConnecting…' : `Tailscale operator\n${tail.online} of ${tail.total} devices on the line\n${tail.devices.filter((d) => d.active).length} talking right now`;
  kit.tipOn(signPlane, () => !backup ? 'Backups' : `Backups: ${backup.ok ? 'all good' : 'trouble: ' + backup.failed.join(', ')}\n` + backup.jobs.map((j) => `${j.ok ? '✓' : '✗'} ${j.name}${j.last ? ' · ' + hhmm(j.last) + ' (' + ago(backup.now - j.last) + ')' : ''}${j.next ? ' · next ' + hhmm(j.next) : ''}`).join('\n'));
  kit.tipOn(ring, () => !backup ? 'Backups' : `Backups: ${backup.ok ? 'all good' : 'trouble: ' + backup.failed.join(', ')}\nLast backup ${backup.last_ok ? hhmm(backup.last_ok) + ' (' + ago(backup.now - backup.last_ok) + ')' : 'never'}`);
  kit.tipOn(fax.children[0], () => !tunnel ? 'Cloudflared' : `Cloudflared fax\n${tunnel.connections} tunnel connections · ${tunnel.errors} errors\n${tunnel.requests} requests handled since it started`);

  return {
    update(d) {
      const x = d.extra || {};
      if (x.docker && x.docker.ok) {
        dock = x.docker;
        crates.forEach((c, i) => {
          const name = i < dock.running ? 'run' : i < dock.running + dock.created + dock.exited ? 'off' : null;
          c.visible = !!name;
          if (name) c.material.color.set(name === 'off' ? '#6b6f7a' : crateColors[i % crateColors.length]);
        });
        dock.unhealthy.concat(dock.restarting).slice(0, 5).forEach((_, k) => crates[k].material.color.set('#ff4d4d'));
      }
      if (x.tailscale && x.tailscale.ok) {
        tail = x.tailscale;
        boardTex.redraw(tail);
        const online = tail.devices.filter((p) => p.online);
        devices.forEach((dv, i) => {
          const p = online[i];
          dv.g.visible = !!p;
          if (!p) return;
          const phone = p.os === 'android' || p.os === 'ios';
          dv.base.scale.set(phone ? 0.3 : 1, 1, phone ? 0.8 : 1);
          dv.base.material = kit.mat(p.os === 'macos' ? '#c9ccd3' : p.os === 'windows' ? '#4a90d9' : p.os === 'linux' ? '#3a3f4b' : phone ? '#22242c' : '#8a8f9b');
          dv.screen.scale.set(phone ? 0.3 : 1, phone ? 0.5 : 1, 1);
          dv.screen.material.emissiveIntensity = p.active ? 1.4 : 0.35;
        });
      }
      if (x.cloudflared) {
        tunnel = x.cloudflared;
        faxLed.material = glow(tunnel.ok ? '#4ade80' : '#ff4d4d', 2);
        faxPile.scale.y = 1 + Math.min(12, tunnel.requests / 40);
        faxPile.position.y = 0.01 * faxPile.scale.y;
        for (let i = 0; i < Math.min(tunnel.fresh_requests, 6); i++) setTimeout(() => { const s = sheets.find((q) => !q.visible); if (s) { s.visible = true; flying.push({ s, age: 0 }); } }, Math.random() * 8000);
      }
      if (x.backups) {
        backup = x.backups;
        const color = backup.ok ? '#4ade80' : '#ff4d4d';
        ring.material = glow(color, 1.4);
        signTex.redraw(backup);
      }
    },
    frame(dt, t) {
      // the engineer works when something just changed, else checks his clipboard
      const busy = dock && (dock.recently_changed || dock.restarting.length || dock.unhealthy.length);
      if (busy) { engineer.shoulderR.rotation.x = -1.2 + Math.sin(t * 7) * 0.4; engineer.elbowR.rotation.x = -1.0; engineer.body.rotation.x = 0.1; }
      else { engineer.shoulderR.rotation.x = -0.95; engineer.elbowR.rotation.x = -1.5; engineer.head.rotation.x = 0.15 + Math.sin(t * 0.8) * 0.1; }
      // the operator plugs cables
      const talking = tail ? tail.devices.filter((p) => p.active).length : 0;
      operator.shoulderL.rotation.x = -0.9 + Math.sin(t * (2 + talking)) * 0.25;
      operator.elbowL.rotation.x = -1.2;
      // pages sliding out of the fax and dropping to the pile
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.age += dt;
        f.s.position.set(0.0 + f.age * 0.3, 0.93 - Math.max(0, f.age - 1) * 0.5, 0.25 + f.age * 0.35);
        if (f.age > 2.2) { f.s.visible = false; flying.splice(i, 1); }
      }
      wheel.rotation.y = tail ? 0.2 * Math.sin(t * 0.5) : 0;
    },
  };
}
