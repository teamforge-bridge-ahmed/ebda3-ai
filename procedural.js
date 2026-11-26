// Procedural pages: real generators, no network, no AI. Draw black on white into a rect.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ARA = Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
const LAT = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

export function maze(ctx, x, y, w, h, seed, level = 2) {
  const R = rng(seed), cols = [8, 12, 16, 22][level] ?? 12;
  const cell = Math.min(w / cols, h / cols), rows = Math.floor(h / cell), cw = cols * cell, ch = rows * cell;
  const ox = x + (w - cw) / 2, oy = y + (h - ch) / 2;
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const wallR = Array.from({ length: rows }, () => Array(cols).fill(true)), wallB = Array.from({ length: rows }, () => Array(cols).fill(true));
  const st = [[0, 0]]; seen[0][0] = true;
  while (st.length) {
    const [cx, cy] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx]);
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    if (dx === 1) wallR[cy][cx] = false; if (dx === -1) wallR[ny][nx] = false;
    if (dy === 1) wallB[cy][cx] = false; if (dy === -1) wallB[ny][nx] = false;
    seen[ny][nx] = true; st.push([nx, ny]);
  }
  ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, cell / 9); ctx.lineCap = 'round'; ctx.beginPath();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = ox + c * cell, py = oy + r * cell;
    if (wallR[r][c] && !(r === rows - 1 && c === cols - 1)) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
    if (wallB[r][c]) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
    if (r === 0 && !(c === 0)) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
    if (c === 0) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
  }
  ctx.stroke();
  ctx.fillStyle = '#000'; ctx.font = `bold ${cell * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▶', ox + cell / 2, oy + cell / 2); ctx.fillText('★', ox + cw - cell / 2, oy + ch - cell / 2);
  ctx.restore();
  return { cols, rows };
}

export function wordSearch(ctx, x, y, w, h, seed, words, lang = 'en', level = 1) {
  const R = rng(seed), N = [10, 12, 14][level] ?? 12, alpha = lang === 'ar' ? ARA : LAT;
  const clean = [...new Set(words.map(s => String(s).trim().replace(/\s+/g, '').toUpperCase()).filter(s => s.length >= 2 && s.length <= N))].slice(0, 10);
  const dirs = lang === 'ar' ? [[-1, 0], [0, 1], [-1, 1]] : [[1, 0], [0, 1], [1, 1]];
  if (level >= 1) dirs.push(lang === 'ar' ? [1, 0] : [-1, 0], [0, -1]);
  const g = Array.from({ length: N }, () => Array(N).fill(''));
  const placed = [];
  for (const wd of clean.sort((a, b) => b.length - a.length)) {
    const ch = Array.from(wd);
    for (let k = 0; k < 200; k++) {
      const [dx, dy] = dirs[Math.floor(R() * dirs.length)], sx = Math.floor(R() * N), sy = Math.floor(R() * N);
      const ex = sx + dx * (ch.length - 1), ey = sy + dy * (ch.length - 1);
      if (ex < 0 || ey < 0 || ex >= N || ey >= N) continue;
      if (ch.every((c, i) => { const v = g[sy + dy * i][sx + dx * i]; return v === '' || v === c; })) { ch.forEach((c, i) => g[sy + dy * i][sx + dx * i] = c); placed.push(wd); break; }
    }
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!g[r][c]) g[r][c] = alpha[Math.floor(R() * alpha.length)];
  const gh = h * 0.68, cell = Math.min(w / N, gh / N), gw = cell * N, ox = x + (w - gw) / 2;
  ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(ox, y, gw, cell * N);
  ctx.fillStyle = '#000'; ctx.font = `600 ${cell * 0.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) ctx.fillText(g[r][c], ox + c * cell + cell / 2, y + r * cell + cell / 2);
  const fs = Math.max(14, cell * 0.5); ctx.font = `${fs}px sans-serif`; ctx.direction = lang === 'ar' ? 'rtl' : 'ltr'; ctx.textAlign = 'center';
  const per = 4, rowsW = Math.ceil(placed.length / per), top = y + cell * N + fs * 1.6;
  placed.forEach((wd, i) => { const r = Math.floor(i / per), c = i % per, cols = Math.min(per, placed.length - r * per); ctx.fillText('☐ ' + wd, x + w * ((c + 0.5) / per), top + r * fs * 1.7); });
  ctx.restore();
  return { placed };
}

export function mandala(ctx, x, y, w, h, seed, level = 1) {
  const R = rng(seed), cx = x + w / 2, cy = y + h / 2, rad = Math.min(w, h) / 2 * 0.95, rings = [5, 7, 9][level] ?? 7;
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, rad / 120);
  ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, rad * 0.97, 0, 7); ctx.stroke();
  const step = rad * 0.9 / rings;
  for (let i = 0; i < rings; i++) {
    const r0 = rad * 0.9 - i * step, r1 = r0 - step, n = [8, 12, 16][Math.floor(R() * 3)], kind = Math.floor(R() * 4);
    for (let k = 0; k < n; k++) {
      ctx.save(); ctx.rotate((k / n) * Math.PI * 2 + (i % 2) * Math.PI / n); ctx.beginPath();
      const half = Math.PI / n * 0.9 * r0 / Math.max(r0, 1);
      const wd = r0 * Math.sin(Math.PI / n) * 0.9;
      if (kind === 0) { ctx.moveTo(0, -r0); ctx.quadraticCurveTo(wd * 1.3, -(r0 + r1) / 2, 0, -r1); ctx.quadraticCurveTo(-wd * 1.3, -(r0 + r1) / 2, 0, -r0); }
      else if (kind === 1) { ctx.arc(0, -(r0 + r1) / 2, step * 0.38, 0, 7); }
      else if (kind === 2) { ctx.moveTo(-wd, -r0); ctx.lineTo(0, -r1); ctx.lineTo(wd, -r0); }
      else { ctx.arc(0, -r0, wd, 0, Math.PI); }
      ctx.stroke(); ctx.restore();
    }
    if (R() > 0.4) { ctx.beginPath(); ctx.arc(0, 0, r1, 0, 7); ctx.stroke(); }
  }
  ctx.beginPath(); ctx.arc(0, 0, step * 0.5, 0, 7); ctx.stroke(); ctx.restore();
}

export function trace(ctx, x, y, w, h, chars, rtl = false) {
  const list = Array.from(String(chars).replace(/[\s,،]+/g, '')).slice(0, 6); if (!list.length) return;
  const rows = list.length, rh = h / rows;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  list.forEach((ch, r) => {
    const cy = y + r * rh + rh / 2, fs = rh * 0.62, nUp = Math.max(2, Math.floor(w / (fs * 1.15)));
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, cy + fs * 0.42); ctx.lineTo(x + w, cy + fs * 0.42); ctx.stroke();
    ctx.setLineDash([fs * 0.05, fs * 0.05]);
    ctx.font = `${fs}px "Comic Sans MS", Tahoma, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(1.5, fs * 0.02); ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000'; ctx.setLineDash([]);
    const first = rtl ? x + w - fs * 0.6 : x + fs * 0.6; ctx.fillText(ch, first, cy);
    ctx.setLineDash([fs * 0.06, fs * 0.07]); ctx.strokeStyle = '#444';
    for (let i = 1; i < nUp; i++) { const px = rtl ? x + w - fs * 0.6 - i * fs * 1.15 : x + fs * 0.6 + i * fs * 1.15; if (px < x + fs * 0.4 || px > x + w - fs * 0.4) break; ctx.strokeText(ch, px, cy); }
  });
  ctx.restore();
}

export function math(ctx, x, y, w, h, seed, level = 1, rtl = false) {
  const R = rng(seed), max = [10, 20, 100][level] ?? 20, n = 10, cols = 2, rows = n / cols, rh = h / rows, cw = w / cols;
  ctx.save(); ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
  ctx.font = `${Math.min(rh * 0.42, cw * 0.1)}px sans-serif`;
  for (let i = 0; i < n; i++) {
    let a = Math.floor(R() * max), b = Math.floor(R() * max); const op = R() > 0.5 ? '+' : '−';
    if (op === '−' && b > a) [a, b] = [b, a];
    const c = i % cols, r = Math.floor(i / cols), px = x + (rtl ? cols - 1 - c : c) * cw + cw / 2, py = y + r * rh + rh / 2;
    ctx.fillText(`${a} ${op} ${b} = ____`, px, py);
  }
  ctx.restore();
}
