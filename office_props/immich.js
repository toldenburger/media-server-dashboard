// Immich: two photo frames on the left wall (a random photo from your library in each, swapped every couple of minutes), and a camera for the
// photographer, who sits at a desk while Immich has uploads or machine learning jobs to work through. Data from sources/immich.py.
export default function (kit) {
  const { THREE } = kit;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '');
  const gb = (b) => (b / 1e9 >= 100 ? Math.round(b / 1e9) : (b / 1e9).toFixed(1)) + ' GB';

  const frames = [-6.8, -5.3].map((z) => {
    kit.rbox(0.08, 1.5, 1.1, 0.02, '#2c2c34', -11.97, 2.0, z);
    const tex = kit.canvasTexture(220, 300, (g, w, h, c) => {
      g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, w, h);
      if (c && c.image) {
        const k = Math.max(w / c.image.width, h / c.image.height);
        g.drawImage(c.image, (w - c.image.width * k) / 2, (h - c.image.height * k) / 2, c.image.width * k, c.image.height * k);
      } else { g.fillStyle = '#a49a88'; g.font = `80px ${FONT}`; g.textAlign = 'center'; g.fillText('📷', w / 2, h / 2 + 24); }
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.8 });
    const pic = kit.plane(0.95, 1.33, mat, -11.92, 2.0, z, Math.PI / 2);
    return { z, tex, pic, id: '', info: null };
  });
  let data = null;
  const tip = (f) => () => !data ? 'Immich' : `Immich photo frame\n${[f.info && f.info.place, f.info && date(f.info.taken)].filter(Boolean).join(' · ') || 'a random photo'}\n${data.photos.toLocaleString('en-GB')} photos and ${data.videos.toLocaleString('en-GB')} videos · ${gb(data.usage)}`;
  frames.forEach((f) => kit.tipOn(f.pic, tip(f)));

  // the photographer wears a camera on a strap; it flashes while there is work
  let camera = null, flashAt = 0;
  function dress(p) {
    const g = kit.group(0, 1.02, 0.2, p.body);
    kit.rbox(0.2, 0.12, 0.09, 0.02, '#1f2026', 0, 0, 0, g);
    kit.cyl(0.04, 0.04, 0.06, '#9aa0ad', 0, 0, 0.07, g).rotation.x = Math.PI / 2;
    const flash = kit.box(0.05, 0.03, 0.02, '#ffffff', 0.06, 0.08, 0.02, g);
    flash.material = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 0 });
    kit.box(0.015, 0.2, 0.01, '#3a3f52', -0.08, 0.1, -0.03, g).rotation.z = 0.3;
    kit.box(0.015, 0.2, 0.01, '#3a3f52', 0.08, 0.1, -0.03, g).rotation.z = -0.3;
    return { g, flash };
  }

  return {
    update(d) {
      const im = d.extra && d.extra.immich;
      data = im && im.ok ? im : null;
      frames.forEach((f, i) => {
        const info = data && data.frames[i];
        f.pic.visible = !!info;
        if (!info || info.id === f.id) return;
        f.id = info.id; f.info = info;
        const img = new Image();
        img.onload = () => { if (f.id === info.id) f.tex.redraw({ image: img }); };
        img.src = info.image;
      });
    },
    frame(dt, t) {
      const p = kit.people.Immich;
      if (!p) return;
      if (!camera) camera = dress(p);
      const busy = !!p.task && p.up;
      if (busy && t - flashAt > 3) flashAt = t;
      camera.flash.material.emissiveIntensity = busy && t - flashAt < 0.15 ? 5 : 0;
    },
  };
}
