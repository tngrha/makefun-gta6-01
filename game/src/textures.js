// SOLMAR HEAT — textures.js
// One clear job: procedural canvas textures for the city. No image files, no
// network: every facade, road marking and sign is painted here at load time.

function makeCanvas(w, h, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  painter(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

// A building facade: warm plaster with a grid of lit and dark windows.
export function buildingTexture(baseHex, seed) {
  const [r, g, b] = hexToRgb(baseHex);
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading so tall towers read as separate slabs.
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    let s = seed * 7919 + 13;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cols = 6, rows = 10;
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rnd() < 0.28;
        ctx.fillStyle = lit ? '#ffd98a' : '#20344a';
        ctx.fillRect(x * cw + 5, y * ch + 6, cw - 10, ch - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x * cw + 5, y * ch + 6, cw - 10, 3);
      }
    }
    // Ground-floor shopfront strip.
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#ffd98a';
    for (let x = 8; x < w - 20; x += 34) ctx.fillRect(x, h - 20, 24, 14);
  });
}

// Asphalt with a dashed centre line, tiled along a road segment.
export function roadTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 200; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    ctx.fillStyle = '#d8d8c8';
    ctx.fillRect(w / 2 - 2, 8, 4, 44);
    ctx.fillRect(w / 2 - 2, 76, 4, 44);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
}

// Sidewalk paving slabs.
export function sidewalkTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
    }
  });
}

// Beach sand with speckles.
export function sandTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(180,150,90,0.5)' : 'rgba(255,245,210,0.5)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// A big painted sign texture for the café / safehouse / docks, drawn from text.
export function signTexture(text, bg, fg) {
  return makeCanvas(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// Soft round sprite used for the mission beacon and muzzle flash.
export function glowTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,220,120,0.6)');
    grad.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}
