import { DIRS } from "./engine.js";

const TW = 56;
const TH = 28;
const BH = 16;

function iso(x, y, z) {
  return {
    sx: (x - y) * (TW / 2),
    sy: (x + y) * (TH / 2) - z * BH,
  };
}

function diamond(ctx, x, y, w, h, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function block(ctx, ox, oy, x, y, z, lamp, lit, isStart) {
  for (let k = 1; k <= z; k++) {
    const p = iso(x, y, k);
    const cx = ox + p.sx;
    const cy = oy + p.sy;
    const topY = cy - TH / 2;

    ctx.beginPath();
    ctx.moveTo(cx - TW / 2, cy);
    ctx.lineTo(cx, cy + TH / 2);
    ctx.lineTo(cx, cy + TH / 2 + BH);
    ctx.lineTo(cx - TW / 2, cy + BH);
    ctx.closePath();
    ctx.fillStyle = k === z ? "#1a3d42" : "#143338";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + TW / 2, cy);
    ctx.lineTo(cx, cy + TH / 2);
    ctx.lineTo(cx, cy + TH / 2 + BH);
    ctx.lineTo(cx + TW / 2, cy + BH);
    ctx.closePath();
    ctx.fillStyle = k === z ? "#0e2a30" : "#0b2228";
    ctx.fill();

    let top = "#2f6b72";
    if (isStart && k === z) top = "#3d7a62";
    if (lamp && k === z) top = lit ? "#f2c14e" : "#7a5a22";
    diamond(ctx, cx, topY + TH / 2, TW, TH, top, "rgba(8,16,20,0.35)");
  }

  if (lamp) {
    const p = iso(x, y, z);
    const cx = ox + p.sx;
    const cy = oy + p.sy - TH / 2 + 2;
    ctx.beginPath();
    star(ctx, cx, cy, lit ? 7 : 5, 5);
    ctx.fillStyle = lit ? "#fff6c8" : "#c9a227";
    ctx.fill();
  }
}

function star(ctx, x, y, r, n) {
  ctx.moveTo(x, y - r);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const b = a + Math.PI / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(b) * (r * 0.4), y + Math.sin(b) * (r * 0.4));
  }
  ctx.closePath();
}

function robot(ctx, ox, oy, bot, z) {
  const p = iso(bot.x, bot.y, z);
  const cx = ox + p.sx;
  const cy = oy + p.sy - 22;
  const ang = [ -0.4, 0.5, Math.PI - 0.4, Math.PI + 0.55 ][bot.dir];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang * 0.15);

  ctx.fillStyle = "#e8f4f2";
  roundRect(ctx, -11, -16, 22, 26, 6);
  ctx.fill();
  ctx.fillStyle = "#0d1c22";
  ctx.fillRect(-8, -10, 16, 8);
  ctx.fillStyle = "#7ee0d0";
  const face = DIRS[bot.dir];
  ctx.beginPath();
  ctx.arc(face.x * 3, -6 + face.y * 1, 2.2, 0, Math.PI * 2);
  ctx.arc(face.x * 3 + 5, -6 + face.y * 1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c45c26";
  ctx.fillRect(-3, -18, 6, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function worldSize(level) {
  const maxZ = Math.max(1, ...level.cells.map((c) => c.z));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < level.depth; y++) {
    for (let x = 0; x < level.width; x++) {
      const p = iso(x, y, 0);
      minX = Math.min(minX, p.sx);
      maxX = Math.max(maxX, p.sx);
      minY = Math.min(minY, p.sy);
      maxY = Math.max(maxY, p.sy);
    }
  }
  return {
    w: maxX - minX + TW + 80,
    h: maxY - minY + TH + maxZ * BH + 120,
    minX,
    minY,
    maxZ,
  };
}

export function drawWorld(canvas, level, rt, highlight) {
  const ctx = canvas.getContext("2d");
  const size = worldSize(level);
  const dpr = window.devicePixelRatio || 1;
  const w = Math.ceil(size.w);
  const h = Math.ceil(size.h);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const ox = w / 2;
  const oy = 50 + size.maxZ * BH - size.minY;

  for (let y = 0; y < level.depth; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.cells.some((c) => c.x === x && c.y === y)) continue;
      const p = iso(x, y, 0);
      diamond(ctx, ox + p.sx, oy + p.sy, TW, TH, "rgba(47,107,114,0.12)", "rgba(126,224,208,0.18)");
    }
  }

  const cells = [...level.cells].sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
  const lit = rt?.lamps || {};
  const bot = rt?.bot || level.start;

  for (const c of cells) {
    const key = `${c.x},${c.y}`;
    const isStart = c.x === level.start.x && c.y === level.start.y;
    block(ctx, ox, oy, c.x, c.y, c.z, c.lamp, !!lit[key], isStart);
  }

  if (highlight) {
    const p = iso(highlight.x, highlight.y, 0);
    diamond(ctx, ox + p.sx, oy + p.sy, TW, TH, "rgba(126,224,208,0.22)", "#7ee0d0");
  }

  const zBot = Math.max(
    1,
    rt ? rt.grid[bot.y]?.[bot.x]?.z || 1 : level.cells.find((c) => c.x === bot.x && c.y === bot.y)?.z || 1
  );
  robot(ctx, ox, oy, bot, zBot);
}

export function pickCell(canvas, level, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const size = worldSize(level);
  const mx = ((clientX - rect.left) * size.w) / rect.width;
  const my = ((clientY - rect.top) * size.h) / rect.height;
  const w = size.w;
  const ox = w / 2;
  const oy = 50 + size.maxZ * BH - size.minY;

  let best = null;
  let bestD = 40;
  for (let y = 0; y < level.depth; y++) {
    for (let x = 0; x < level.width; x++) {
      const p = iso(x, y, 0);
      const dx = mx - (ox + p.sx);
      const dy = my - (oy + p.sy);
      const d = Math.abs(dx) / (TW / 2) + Math.abs(dy) / (TH / 2);
      if (d < 1.15 && d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}
