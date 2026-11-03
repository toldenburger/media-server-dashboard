// Home Assistant: a radiator and thermostat under the right window, an electricity price ticker above the door, and the office lamps, which take
// the colour and brightness of your living room lights. Data from sources/homeassistant.py.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const eur = (n) => '€' + n.toFixed(3);
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  let ha = null;

  // ---------- radiator and thermostat ----------
  const rad = kit.group(10.6, 0, -8.82);
  const panelMat = new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.6, emissive: '#ff7a3a', emissiveIntensity: 0 });
  const panel = kit.rbox(1.3, 0.62, 0.09, 0.03, '#efede8', 0, 0.62, 0, rad);
  panel.material = panelMat;
  for (let i = 0; i < 9; i++) kit.box(0.025, 0.5, 0.1, '#d8d4cb', -0.56 + i * 0.14, 0.62, 0.01, rad);
  kit.cyl(0.025, 0.025, 0.2, '#c9ced6', -0.7, 0.2, 0.02, rad);
  kit.cyl(0.025, 0.025, 0.2, '#c9ced6', 0.7, 0.2, 0.02, rad);
  const dialTex = kit.canvasTexture(160, 160, (g, w, h, t) => {
    g.fillStyle = '#1d1f2b'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    if (!t) { g.fillStyle = '#9aa0b4'; g.font = `600 26px ${FONT}`; g.fillText('…', w / 2, h / 2 + 8); return; }
    const heating = t.mode === 'heat' && t.target != null && t.current != null && t.target > t.current + 0.1;
    g.strokeStyle = heating ? '#ff9b4a' : '#4ade80'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, 68, 0, 7); g.stroke();
    g.fillStyle = '#ffffff'; g.font = `800 50px ${FONT}`; g.fillText(t.current != null ? t.current.toFixed(1) + '°' : '--', w / 2, h / 2 + 12);
    g.fillStyle = '#9aa0b4'; g.font = `600 22px ${FONT}`; g.fillText(t.target != null ? '→ ' + t.target.toFixed(1) + '°' : '', w / 2, h / 2 + 44);
  });
  const dialMat = new THREE.MeshStandardMaterial({ map: dialTex, emissiveMap: dialTex, emissive: '#ffffff', emissiveIntensity: 0.6 });
  kit.cyl(0.2, 0.2, 0.05, '#e9e6df', 11.62, 1.5, -8.95).rotation.x = Math.PI / 2;
  const dial = kit.plane(0.3, 0.3, dialMat, 11.62, 1.5, -8.92);
  const thermoTip = () => !ha || !ha.thermostat ? 'Thermostat' : `Heating\nRoom ${ha.thermostat.current}° · target ${ha.thermostat.target}°\nMode: ${ha.thermostat.mode}${ha.thermostat.water ? ' · hot water ' + ha.thermostat.water : ''}`;
  kit.tipOn(panel, thermoTip, 'homeassistant');
  kit.tipOn(dial, thermoTip, 'homeassistant');

  // ---------- electricity price ticker above the door ----------
  const W = 768, H = 192;
  const tickerTex = kit.canvasTexture(W, H, (g, w, h, p) => {
    g.fillStyle = '#14161f'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.fillStyle = '#9aa0b4'; g.font = `700 24px ${FONT}`; g.fillText('ELECTRICITY NOW', 24, 38);
    if (!p) { g.font = `600 40px ${FONT}`; g.fillText('…', 24, 110); return; }
    const cheap = p.avg != null && p.now <= p.avg;
    g.fillStyle = cheap ? '#4ade80' : '#ff8f6b'; g.font = `800 64px ${FONT}`; g.fillText(eur(p.now), 24, 106);
    g.fillStyle = '#9aa0b4'; g.font = `500 22px ${FONT}`; g.fillText(`${p.unit || ''}  ·  ${cheap ? 'below' : 'above'} average`, 24, 140);
    const bars = (p.hourly || []).slice(0, 24);
    if (!bars.length) return;
    const lo = Math.min(...bars.map((b) => b.p)), hi = Math.max(...bars.map((b) => b.p)), x0 = 330, bw = (w - x0 - 24) / bars.length;
    bars.forEach((b, i) => {
      const hh = 20 + (b.p - lo) / Math.max(0.001, hi - lo) * 100;
      g.fillStyle = b.p <= (p.avg || lo) ? '#4ade80' : '#ff8f6b'; g.globalAlpha = i === 0 ? 1 : 0.7;
      g.fillRect(x0 + i * bw + 1, h - 22 - hh, bw - 3, hh);
    });
    g.globalAlpha = 1; g.fillStyle = '#9aa0b4'; g.font = `500 18px ${FONT}`; g.fillText('next 24 h', x0, 32);
  });
  const tickerMat = new THREE.MeshStandardMaterial({ map: tickerTex, emissiveMap: tickerTex, emissive: '#ffffff', emissiveIntensity: 0.7 });
  kit.rbox(0.08, 0.5, 1.9, 0.03, '#2c2c34', -11.97, 2.95, 4.1);
  const ticker = kit.plane(1.82, 0.455, tickerMat, -11.92, 2.95, 4.1, Math.PI / 2);
  kit.tipOn(ticker, () => {
    const p = ha && ha.price;
    if (!p) return 'Electricity price';
    const cheapest = (p.hourly || []).reduce((a, b) => (!a || b.p < a.p ? b : a), null);
    return `Electricity ${eur(p.now)} per kWh now\nToday: low ${eur(p.min)} · average ${eur(p.avg)} · high ${eur(p.max)}${cheapest ? '\nCheapest coming hour: ' + hhmm(cheapest.t) + ' (' + eur(cheapest.p) + ')' : ''}`;
   }, 'homeassistant');

  // ---------- the office lamps follow the living room ----------
  const want = new THREE.Color('#ffc98a'), now = new THREE.Color('#ffc98a');
  let brightness = 1, shown = 1;

  return {
    update(d) {
      const x = d.extra && d.extra.homeassistant;
      ha = x && x.ok ? x : null;
      dialTex.redraw(ha && ha.thermostat); tickerTex.redraw(ha && ha.price);
      if (ha && ha.thermostat) {
        const t = ha.thermostat;
        panelMat.emissiveIntensity = t.mode === 'heat' && t.target > t.current + 0.1 ? 0.55 : 0;
      }
      if (ha && ha.lamps) { want.setRGB(ha.lamps.rgb[0] / 255, ha.lamps.rgb[1] / 255, ha.lamps.rgb[2] / 255); brightness = ha.lamps.on ? ha.lamps.brightness : 0.08; }
    },
    frame(dt) {
      const k = Math.min(1, dt * 1.5);
      now.lerp(want, k); shown += (brightness - shown) * k;
      const { glow, shades } = kit.lamps;
      glow.color.copy(now); glow.intensity = 6 * shown;
      for (const m of shades) { m.emissive.copy(now); m.emissiveIntensity = 0.1 + 0.8 * shown; }
    },
  };
}
