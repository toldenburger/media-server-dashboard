// The gaming nook on the right edge of the beanbag corner: a TV on a low cabinet with a game console and a controller.
// It sleeps on a "ready" screen and wakes up with an animated one while someone streams from Sunshine. Data from sources/sunshine.py.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const ago = (unix, now) => { const h = Math.max(1, Math.round((now - unix) / 3600)); return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`; };
  let data = null, frameAt = 0;

  const nook = kit.group(11.25, 0, 4.4, undefined, Math.PI / 4);
  kit.rbox(1.6, 0.42, 0.5, 0.04, '#5a4a3c', 0, 0.21, 0, nook);
  [-0.4, 0.4].forEach((x) => { kit.rbox(0.7, 0.3, 0.02, 0.01, '#6b5a4a', x, 0.21, 0.255, nook); kit.rbox(0.12, 0.025, 0.03, 0.01, '#c9ced6', x * 0.3, 0.3, 0.27, nook); });
  kit.box(0.5, 0.03, 0.25, '#23252e', 0, 0.435, 0, nook);
  kit.box(0.08, 0.2, 0.06, '#23252e', 0, 0.55, -0.02, nook);
  kit.rbox(1.34, 0.78, 0.07, 0.03, '#14151b', 0, 1.0, -0.02, nook);

  const tex = kit.canvasTexture(512, 288, (g, w, h, s) => {
    const t = (s && s.t) || 0;
    g.textAlign = 'center';
    if (s && s.streaming) {
      for (let i = 0; i < 9; i++) {  // slow moving colour bands
        g.fillStyle = `hsl(${(i * 40 + t * 40) % 360}, 70%, ${28 + 10 * Math.sin(t * 1.5 + i)}%)`;
        g.fillRect(0, i * (h / 9), w, h / 9 + 1);
      }
      g.fillStyle = 'rgba(8,10,18,.55)'; g.fillRect(0, 0, w, h);
      g.fillStyle = Math.floor(t * 1.6) % 2 ? '#ff4d4d' : '#ff9b9b'; g.beginPath(); g.arc(40, 38, 11, 0, 7); g.fill();
      g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = `700 26px ${FONT}`; g.fillText('STREAMING', 62, 48);
      g.textAlign = 'center'; g.font = `800 50px ${FONT}`; g.fillText(s.app || 'a stream', w / 2, h / 2 + 18);
      g.font = `600 26px ${FONT}`; g.fillStyle = '#e9ecf2'; g.fillText(`${s.who || 'a device'} · ${s.minutes} min`, w / 2, h / 2 + 64);
    } else {
      g.fillStyle = '#0b0d14'; g.fillRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h * 0.95, 4, w / 2, h * 0.95, h * 0.8);
      gr.addColorStop(0, 'rgba(255,190,90,.55)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2c94c'; g.font = `800 44px ${FONT}`; g.fillText('☀ SUNSHINE', w / 2, h / 2 - 10);
      g.fillStyle = '#9aa0b4'; g.font = `600 26px ${FONT}`;
      g.fillText(s && s.running === false ? 'not running' : `ready · ${s && s.paired ? s.paired : 0} device${s && s.paired === 1 ? '' : 's'} paired`, w / 2, h / 2 + 34);
    }
  });
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.4 });
  const screen = kit.plane(1.22, 0.686, screenMat, 0, 1.0, 0.02, 0, 0, nook);

  const consoleBody = kit.rbox(0.4, 0.07, 0.3, 0.02, '#e9e9ee', 0.5, 0.5, 0.06, nook);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#2a3a2e', emissive: '#4ade80', emissiveIntensity: 0.05 });
  kit.box(0.3, 0.012, 0.012, ledMat, 0.5, 0.5, 0.215, nook);
  // the controller lies on the floor in front of the cabinet
  const pad = kit.group(-0.1, 0.03, 0.85, nook, 0.3);
  kit.rbox(0.26, 0.05, 0.17, 0.04, '#2c2f3a', 0, 0, 0, pad);
  [-0.08, 0.08].forEach((x, i) => kit.cyl(0.025, 0.025, 0.03, i ? '#d64b4b' : '#4a90d9', x, 0.035, i ? 0.02 : -0.02, pad));

  const tip = () => {
    if (!data) return 'Sunshine';
    if (!data.running) return 'Sunshine is not running';
    if (data.streaming) return `Streaming ${data.app || ''}\\n${data.clients.join(', ') || 'a device'} · ${Math.max(1, Math.round((data.now - data.since) / 60))} min so far`;
    return `Sunshine is ready; nobody is streaming\\n${data.clients.length} paired device${data.clients.length === 1 ? '' : 's'}${data.clients.length ? ': ' + data.clients.join(', ') : ''}\\n${data.last_session ? 'Last stream ' + ago(data.last_session, data.now) + ' · ' : ''}${data.sessions_week} stream${data.sessions_week === 1 ? '' : 's'} in the past week`;
  };
  kit.tipOn(screen, tip, 'sunshine');
  kit.tipOn(consoleBody, tip, 'sunshine');

  const state = () => ({ streaming: !!(data && data.streaming), running: data ? data.running : true, app: data && data.app, who: data && data.clients[0], minutes: data && data.streaming ? Math.max(1, Math.round((data.now - data.since) / 60)) : 0, paired: data ? data.clients.length : 0, t: performance.now() / 1000 });

  return {
    update(d) {
      const s = d.extra && d.extra.sunshine;
      data = s && s.ok ? s : null;
      tex.redraw(state());
    },
    frame(dt, t) {
      const streaming = !!(data && data.streaming);
      screenMat.emissiveIntensity = streaming ? 0.85 + 0.1 * Math.sin(t * 3) : 0.35;
      ledMat.emissiveIntensity = streaming ? 1.2 + 0.8 * Math.sin(t * 4) : 0.05;
      if (streaming && t - frameAt > 0.18) { frameAt = t; tex.redraw(state()); }  // animate the screen a few times a second
    },
  };
}
