// The rest of the garden: a slanted solar array in front of the tree and a heat pump to its right. Data from sources/homeassistant.py.
//  - the panels glow with the solar power now (they sleep when the inverter does), the sign by the array has the numbers
//  - the heat pump's fan turns while the compressor runs, its light shows what it is doing, puffs rise when it works in the cold,
//    and its sign shows the COP (heat out per electricity in). Hover either for the details, double-click opens Home Assistant.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const kw = (w) => (w >= 1000 ? (w / 1000).toFixed(2) + ' kW' : Math.round(w) + ' W');
  const num = (v, d = 1) => (v === null || v === undefined ? '–' : Number(v).toFixed(d));
  let ha = null;

  function sign(x, z, ry, w, h, tex) {  // a board on a post, tilted a little towards the camera
    const g = kit.group(x, 0, z, undefined, ry);
    kit.box(0.06, 0.95, 0.06, '#6b4a2e', 0, 0.475, 0, g);
    kit.rbox(w + 0.08, h + 0.08, 0.05, 0.02, '#2b2d36', 0, 0.95 + h / 2, 0, g).rotation.x = -0.2;
    const m = kit.plane(w, h, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.7 }), 0, 0.95 + h / 2, 0.03, 0, -0.2, g);
    return { g, m };
  }
  const wrapTip = (obj, fn) => kit.tipOn(obj, fn, 'homeassistant');

  // ---------- the solar array, in front of the tree, panels slanting towards the camera ----------
  const ARR = kit.group(15.7, 0, 0.6);
  const cell = kit.canvasTexture(128, 192, (g, w, h) => {
    g.fillStyle = '#1c3766'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9fb6dc'; g.lineWidth = 2;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * w / 6, 6); g.lineTo(i * w / 6, h - 6); g.stroke(); }
    for (let j = 1; j < 10; j++) { g.beginPath(); g.moveTo(6, j * h / 10); g.lineTo(w - 6, j * h / 10); g.stroke(); }
    g.strokeStyle = '#e8ecf4'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  const panels = [];
  const TILT = 0.5;
  for (let i = 0; i < 5; i++) {
    const material = new THREE.MeshStandardMaterial({ map: cell, emissiveMap: cell, emissive: '#5a8cff', emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.25 });
    const pivot = kit.group((i - 2) * 1.04, 0.62, 0, ARR);
    pivot.rotation.x = TILT;
    const face = kit.plane(1.0, 1.6, material, 0, 0.022, 0, 0, -Math.PI / 2, pivot);
    kit.box(1.02, 0.04, 1.62, '#cfd4de', 0, 0, 0, pivot);
    panels.push({ material, face });
  }
  [-2.5, -0.9, 0.9, 2.5].forEach((x) => {  // posts: the back ones are taller than the front ones
    kit.box(0.06, 0.75, 0.06, '#8d95a3', x, 0.375, -0.7, ARR);
    kit.box(0.06, 0.4, 0.06, '#8d95a3', x, 0.2, 0.7, ARR);
  });
  kit.box(5.3, 0.05, 0.05, '#8d95a3', 0, 0.35, 0.7, ARR);

  const solarTex = kit.canvasTexture(512, 256, (g, w, h, d) => {
    g.fillStyle = '#151a28'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffd84a'; g.font = `800 34px ${FONT}`; g.fillText('☀ SOLAR', 22, 50);
    if (!d) { g.fillStyle = '#9aa0b4'; g.font = `600 30px ${FONT}`; g.fillText('no data', 22, 120); return; }
    if (d.asleep) {
      g.fillStyle = '#7f89a8'; g.font = `700 54px ${FONT}`; g.fillText('asleep', 22, 128);
      g.fillStyle = '#5d6684'; g.font = `500 26px ${FONT}`; g.fillText('no sun, the inverter rests', 22, 170);
    } else {
      g.fillStyle = '#ffe27a'; g.font = `800 78px ${FONT}`; g.fillText(kw(d.watts), 22, 132);
      g.fillStyle = '#2a3148'; g.fillRect(22, 156, 468, 22);
      g.fillStyle = '#ffd84a'; g.fillRect(22, 156, 468 * Math.min(1, d.watts / d.peak), 22);
    }
    g.fillStyle = '#9aa0b4'; g.font = `500 24px ${FONT}`;
    const bits = [];
    if (d.today_kwh !== null && d.today_kwh !== undefined) bits.push(`today ${num(d.today_kwh)} kWh`);
    if (d.lifetime_kwh) bits.push(`total ${Math.round(d.lifetime_kwh / 1000 * 10) / 10} MWh`);
    g.fillText(bits.join(' · ') || 'SolarEdge', 22, 224);
  });
  const solarSign = sign(13.35, 2.6, 0.55, 1.0, 0.5, solarTex);
  const solarTip = () => {
    const s = ha && ha.solar;
    if (!s) return 'Solar panels';
    return ['Solar panels (SolarEdge)', s.asleep ? 'Asleep: no production right now' : `Producing ${kw(s.watts)} (${Math.round(s.watts / s.peak * 100)}% of the best seen)`,
      s.today_kwh !== null && s.today_kwh !== undefined ? `Today: ${num(s.today_kwh)} kWh` : '', s.lifetime_kwh ? `All time: ${num(s.lifetime_kwh / 1000)} MWh` : ''].filter(Boolean).join('\n');
  };
  panels.forEach((p) => wrapTip(p.face, solarTip));
  wrapTip(solarSign.m, solarTip);

  // ---------- the heat pump, to the right of the tree ----------
  const HX = 22.4, HZ = -5.0;
  const hp = kit.group(HX, 0, HZ);
  hp.scale.setScalar(1.25);
  kit.box(1.7, 0.06, 0.9, '#a9adb7', 0, 0.03, 0, hp);  // concrete pad
  [-0.4, 0.4].forEach((x) => kit.box(0.14, 0.06, 0.5, '#2b2d36', x, 0.09, 0, hp));
  const body = kit.rbox(1.1, 0.78, 0.42, 0.04, '#f3f4f6', 0, 0.51, 0, hp);
  kit.rbox(1.12, 0.05, 0.44, 0.02, '#d9dce3', 0, 0.92, 0, hp);
  const FAN = [-0.2, 0.52];  // fan centre (x, y) on the front face
  kit.torus(0.27, 0.025, Math.PI * 2, '#9aa0ad', FAN[0], FAN[1], 0.215, hp);
  const fan = kit.group(FAN[0], FAN[1], 0.19, hp);
  for (let b = 0; b < 4; b++) { const arm = kit.group(0, 0, 0, fan); arm.rotation.z = b * Math.PI / 2; const blade = kit.rbox(0.09, 0.23, 0.012, 0.01, '#6b7280', 0.03, 0.13, 0, arm); blade.rotation.y = 0.5; }
  kit.cyl(0.04, 0.04, 0.03, '#2b2d36', 0, 0, 0.01, fan).rotation.x = Math.PI / 2;
  [0, 1, 2, 3, 4, 5].forEach((i) => kit.box(0.2, 0.012, 0.01, '#cfd3dc', 0.38, 0.28 + i * 0.1, 0.215, hp));  // side louvres
  const brand = kit.canvasTexture(256, 64, (g, w, h) => { g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#0a8fd0'; g.font = `800 40px ${FONT}`; g.textAlign = 'center'; g.fillText('DAIKIN', w / 2, 46); });
  kit.plane(0.4, 0.1, new THREE.MeshStandardMaterial({ map: brand }), 0.32, 0.82, 0.213, 0, 0, hp);
  const led = kit.ball(0.03, kit.mat('#4ade80', { emissive: '#4ade80', emissiveIntensity: 1 }), 0.45, 0.88, 0.215, hp);
  led.castShadow = false;
  // two lagged pipes running under the grass to the house
  kit.box(9.4, 0.07, 0.08, '#d85a4a', -5.6, 0.04, 0.2, hp);
  kit.box(9.4, 0.07, 0.08, '#4a8ad8', -5.6, 0.04, 0.34, hp);

  const puffTex = kit.canvasTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const puffs = [0, 1, 2, 3].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    hp.add(s);
    return { s, i };
  });

  const copColor = (c) => (c >= 4 ? '#4ade80' : c >= 3 ? '#ffd84a' : '#ff9a4a');
  const hpTex = kit.canvasTexture(512, 256, (g, w, h, d) => {
    g.fillStyle = '#151a28'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#6fd0ff'; g.font = `800 32px ${FONT}`; g.fillText('HEAT PUMP', 22, 46);
    if (!d) { g.fillStyle = '#9aa0b4'; g.font = `600 30px ${FONT}`; g.fillText('no data', 22, 120); return; }
    const state = d.error ? 'error ' + d.error : d.defrost ? 'defrosting' : d.running ? (d.hot_water ? 'making hot water' : 'heating') : 'idle';
    g.fillStyle = d.error ? '#ff6b6b' : d.defrost ? '#ffb347' : d.running ? '#9ae6b4' : '#7f89a8'; g.font = `700 36px ${FONT}`; g.fillText(state, 22, 92);
    g.fillStyle = copColor(d.cop || 0); g.font = `800 84px ${FONT}`; g.fillText(d.running && d.cop ? 'COP ' + num(d.cop) : d.cop_today ? 'COP ' + num(d.cop_today) : 'COP –', 22, 176);
    g.fillStyle = '#9aa0b4'; g.font = `500 24px ${FONT}`;
    g.fillText(d.running ? `${d.heat_kw !== null ? num(d.heat_kw, 1) + ' kW heat' : ''}${d.electric_w ? ' for ' + Math.round(d.electric_w) + ' W' : ''}` : `${d.running ? '' : 'today '}${num(d.cop_today)} on average`, 22, 214);
    g.fillText(`outside ${num(d.outdoor, 0)}°C · water ${num(d.leaving_water, 0)}°C`, 22, 244);
  });
  const hpSign = sign(20.5, -3.2, 0.55, 1.0, 0.5, hpTex);
  const hpTip = () => {
    const d = ha && ha.heatpump;
    if (!d) return 'Heat pump';
    const state = d.error ? 'Error: ' + d.error : d.defrost ? 'Defrosting' : d.running ? (d.hot_water ? 'Making hot water' : 'Heating the house') : 'Idle';
    return ['Daikin heat pump', state, d.running ? `${num(d.heat_kw, 2)} kW of heat from ${Math.round(d.electric_w || 0)} W · COP now ${num(d.cop)}` : '',
      `COP today ${num(d.cop_today, 2)} (${num(d.heat_today_kwh)} kWh heat from ${num(d.electric_today_kwh)} kWh)`, `Outside ${num(d.outdoor, 0)}°C · leaving water ${num(d.leaving_water, 0)}°C`].filter(Boolean).join('\n');
  };
  wrapTip(body, hpTip);
  wrapTip(hpSign.m, hpTip);

  kit.extendView([[HX + 1.2, 1.2, HZ], [13.2, 0, 3.0]]);

  let spin = 0, solarKey = '', hpKey = '';
  return {
    update(d) {
      ha = d.extra && d.extra.homeassistant && d.extra.homeassistant.ok ? d.extra.homeassistant : null;
      const s = ha && ha.solar, h = ha && ha.heatpump;
      const sk = JSON.stringify(s), hk = JSON.stringify(h);
      if (sk !== solarKey) { solarKey = sk; solarTex.redraw(s); }
      if (hk !== hpKey) { hpKey = hk; hpTex.redraw(h); }
    },
    frame(dt, t) {
      const s = ha && ha.solar, h = ha && ha.heatpump;
      const level = s && !s.asleep ? Math.min(1, s.watts / s.peak) : 0;
      panels.forEach((p, i) => { p.material.emissiveIntensity = 0.04 + level * (1.5 + 0.3 * Math.sin(t * 1.5 + i * 0.7)); });
      const run = h && h.running ? 1 : 0;
      const target = run ? 3 + (h.compressor || 10) * 0.35 : 0;
      spin += (target - spin) * Math.min(1, dt * 2);
      fan.rotation.z -= spin * dt;
      const col = !h ? '#4a5060' : h.error ? '#ff4d4d' : h.defrost ? '#ffb347' : h.running ? '#4ade80' : '#5ab0ff';
      led.material.color.set(col); led.material.emissive.set(col);
      led.material.emissiveIntensity = h && h.running ? 1.1 + 0.4 * Math.sin(t * 3) : 0.5;
      const cold = h && h.outdoor !== null && h.outdoor < 10;
      puffs.forEach((p) => {
        const k = ((t * 0.3 + p.i / puffs.length) % 1), big = h && h.defrost ? 1.8 : 1;
        p.s.position.set(-0.2 + Math.sin(k * 5 + p.i) * 0.1, 1.0 + k * 0.9, 0.1);
        p.s.scale.setScalar((0.3 + k * 0.6) * big);
        p.s.material.opacity = run && (cold || (h && h.defrost)) ? Math.sin(k * Math.PI) * 0.7 : 0;
      });
    },
  };
}
