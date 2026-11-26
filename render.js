// Page rendering to canvas (works for preview, PNG and PDF export). Arabic shaping and RTL come from the browser.
import * as P from './procedural.js';
export const SIZES = { sq: [8.5, 8.5], us: [8.5, 11], '69': [6, 9], '810': [8, 10], a4: [8.27, 11.69], a5: [5.83, 8.27] };
export const BLEED = 0.125, MARGIN = 0.5;
export const FONT = '"Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif';
const imgCache = new Map();
export function loadImg(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  if (imgCache.has(dataUrl)) return imgCache.get(dataUrl);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl; });
  if (imgCache.size > 40) imgCache.delete(imgCache.keys().next().value);
  imgCache.set(dataUrl, p); return p;
}
export function dims(book, dpi, bleed) {
  const [w, h] = SIZES[book.size] || SIZES.sq;
  return { w: Math.round((w + (bleed ? BLEED : 0)) * dpi), h: Math.round((h + (bleed ? 2 * BLEED : 0)) * dpi), tw: w, th: h };
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function drawText(ctx, text, box, { lang, maxFs, minFs, fixed, align, color = '#111', weight = 400, lineH = 1.45 }) {
  const rtl = lang === 'ar'; ctx.direction = rtl ? 'rtl' : 'ltr';
  const paras = String(text || '').split(/\n+/).filter(Boolean);
  const al = align || (rtl ? 'right' : 'left'); ctx.textAlign = al; ctx.textBaseline = 'top'; ctx.fillStyle = color;
  const layout = (fs) => {
    ctx.font = `${weight} ${fs}px ${FONT}`; const lines = [];
    for (const para of paras) {
      let cur = '';
      for (const wd of para.split(/\s+/)) {
        const tst = cur ? cur + ' ' + wd : wd;
        if (ctx.measureText(tst).width > box.w && cur) { lines.push(cur); cur = wd; } else cur = tst;
      }
      if (cur) lines.push(cur); lines.push(null);
    }
    lines.pop(); return lines;
  };
  let fs = fixed || maxFs, lines = layout(fs);
  const hOf = (l, f) => l.reduce((a, s) => a + (s === null ? f * 0.5 : f * lineH), 0);
  if (!fixed) while (hOf(lines, fs) > box.h && fs > minFs) { fs = Math.max(minFs, fs * 0.94); lines = layout(fs); }
  const total = hOf(lines, fs), overflow = total > box.h + 1;
  let y = box.y + (box.vcenter ? Math.max(0, (box.h - total) / 2) : 0);
  const tx = al === 'center' ? box.x + box.w / 2 : al === 'right' ? box.x + box.w : box.x;
  for (const l of lines) { if (l === null) { y += fs * 0.5; continue; } if (y + fs <= box.y + box.h + fs * 0.5) ctx.fillText(l, tx, y); y += fs * lineH; }
  return { overflow, fs };
}
function cover(ctx, img, x, y, w, h, radius = 0) {
  ctx.save(); if (radius) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip(); } else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
}
function contain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderPage(book, page, { dpi = 100, bleed = false, index = 0 } = {}) {
  const { w, h } = dims(book, dpi, bleed), c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const off = bleed ? ((index % 2 === 0) === (book.lang !== 'ar') ? 0 : BLEED * dpi) : 0, offY = bleed ? BLEED * dpi : 0;
  const tw = dims(book, dpi, false).w, th = dims(book, dpi, false).h, m = MARGIN * dpi;
  const X = off, Y = offY, lang = book.lang;
  c.meta = { overflow: false, lowres: false };
  const img = page.image ? await loadImg(page.image.dataUrl) : null;
  const kind = page.kind || 'story';
  if (kind === 'blank') return c;
  if (kind === 'image') {
    if (img) {
      if (book.type === 'coloring') {
        contain(ctx, img, X + m, Y + m, tw - 2 * m, th - 2 * m - (page.text ? dpi * 0.75 : 0));
        ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, dpi / 40); ctx.strokeRect(X + m * 0.6, Y + m * 0.6, tw - m * 1.2, th - m * 1.2 - (page.text ? dpi * 0.75 : 0));
      } else cover(ctx, img, bleed ? 0 : X, bleed ? 0 : Y, w, h);
      c.meta.lowres = Math.min(img.width / ((tw - 2 * m) / dpi), img.height / ((th - 2 * m) / dpi)) < 150;
    }
    if (page.text) { const r = drawText(ctx, page.text, { x: X + m, y: Y + th - m - dpi * 0.5, w: tw - 2 * m, h: dpi * 0.5 }, { lang, maxFs: dpi * 0.3, minFs: dpi * 0.15, align: 'center', color: book.type === 'coloring' ? '#000' : '#fff' }); c.meta.overflow = r.overflow; }
    return c;
  }
  if (kind === 'story') {
    const ih = (th - 2 * m) * 0.6;
    if (img) { cover(ctx, img, X + m, Y + m, tw - 2 * m, ih, dpi * 0.15); c.meta.lowres = img.width / ((tw - 2 * m) / dpi) < 120; }
    else { ctx.strokeStyle = '#ccc'; ctx.setLineDash([8, 8]); ctx.strokeRect(X + m, Y + m, tw - 2 * m, ih); ctx.setLineDash([]); }
    const r = drawText(ctx, page.text, { x: X + m, y: Y + m + ih + dpi * 0.25, w: tw - 2 * m, h: th - 2 * m - ih - dpi * 0.25 - dpi * 0.3 }, { lang, maxFs: dpi * 0.34, minFs: dpi * 0.16, fixed: page.fontSize ? page.fontSize * dpi / 100 : 0, align: 'center' });
    c.meta.overflow = r.overflow; drawFolio(ctx, book, page, index, X, Y, tw, th, dpi); return c;
  }
  if (kind === 'text') {
    let y = Y + m;
    if (page.title) { const t = drawText(ctx, page.title, { x: X + m, y, w: tw - 2 * m, h: dpi * 1.2 }, { lang, maxFs: dpi * 0.5, minFs: dpi * 0.25, weight: 700, color: '#312e81' }); y += Math.min(dpi * 1.1, t.fs * 1.8); }
    const r = drawText(ctx, page.text, { x: X + m, y, w: tw - 2 * m, h: Y + th - m - y - dpi * 0.3 }, { lang, maxFs: dpi * 0.28, minFs: dpi * 0.14, fixed: page.fontSize ? page.fontSize * dpi / 100 : 0 });
    c.meta.overflow = r.overflow; drawFolio(ctx, book, page, index, X, Y, tw, th, dpi); return c;
  }
  if (kind === 'puzzle') {
    const z = page.puzzle || {}; const rtl = lang === 'ar';
    let y = Y + m;
    const tt = drawText(ctx, page.title || '', { x: X + m, y, w: tw - 2 * m, h: dpi * 0.9 }, { lang, maxFs: dpi * 0.5, minFs: dpi * 0.25, weight: 700, align: 'center' }); y += dpi * 0.75;
    if (page.text) { const r = drawText(ctx, page.text, { x: X + m, y, w: tw - 2 * m, h: dpi * 0.7 }, { lang, maxFs: dpi * 0.24, minFs: dpi * 0.14, align: 'center', color: '#444' }); c.meta.overflow = r.overflow; y += dpi * 0.7; }
    const area = { x: X + m, y, w: tw - 2 * m, h: Y + th - m - y };
    if (z.type === 'maze') P.maze(ctx, area.x, area.y, area.w, area.h, z.seed, z.level ?? 1);
    else if (z.type === 'wordsearch') P.wordSearch(ctx, area.x, area.y, area.w, area.h, z.seed, z.words || [], lang, z.level ?? 1);
    else if (z.type === 'mandala') P.mandala(ctx, area.x, area.y, area.w, area.h, z.seed, z.level ?? 1);
    else if (z.type === 'trace') P.trace(ctx, area.x, area.y, area.w, area.h, z.chars || '', rtl);
    else if (z.type === 'math') P.math(ctx, area.x, area.y, area.w, area.h, z.seed, z.level ?? 1, rtl);
    drawFolio(ctx, book, page, index, X, Y, tw, th, dpi); return c;
  }
  return c;
}
function drawFolio(ctx, book, page, index, X, Y, tw, th, dpi) {
  ctx.save(); ctx.fillStyle = '#777'; ctx.font = `${dpi * 0.14}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
  ctx.fillText(String(index + 1), X + tw / 2, Y + th - dpi * 0.22); ctx.restore();
}

export async function drawCoverFront(ctx, x, y, w, h, book, scale) {
  const col = book.coverColor || '#4f46e5';
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, col); g.addColorStop(1, shade(col, -0.45));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const img = book.cover?.image ? await loadImg(book.cover.image.dataUrl) : null;
  const pad = w * 0.07, topH = h * 0.27, imgY = y + topH + pad * 0.5, imgH = h - topH - pad * 2.6;
  if (img) { cover(ctx, img, x + pad, imgY, w - 2 * pad, imgH, w * 0.03); }
  else { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(x + pad, imgY, w - 2 * pad, imgH, w * 0.03); ctx.fill(); }
  const t = drawText(ctx, book.title || '', { x: x + pad, y: y + pad, w: w - 2 * pad, h: topH * 0.62, vcenter: true }, { lang: book.lang, maxFs: w * 0.1, minFs: w * 0.04, weight: 800, align: 'center', color: '#fff', lineH: 1.25 });
  if (book.subtitle) drawText(ctx, book.subtitle, { x: x + pad, y: y + pad + topH * 0.64, w: w - 2 * pad, h: topH * 0.32 }, { lang: book.lang, maxFs: w * 0.045, minFs: w * 0.025, align: 'center', color: '#fde68a', lineH: 1.3 });
  if (book.author) drawText(ctx, book.author, { x: x + pad, y: y + h - pad * 2, w: w - 2 * pad, h: pad * 1.5 }, { lang: book.lang, maxFs: w * 0.05, minFs: w * 0.03, align: 'center', color: '#fff', weight: 600, lineH: 1.2 });
  return t.overflow;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, k = f < 0 ? 0 : 255, p = Math.abs(f);
  const m = (v) => Math.round((k - v) * p + v); return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export async function renderCover(book, { dpi = 100, bleed = false } = {}) {
  const { w, h } = dims(book, dpi, bleed), c = canvas(w, h), ctx = c.getContext('2d');
  await drawCoverFront(ctx, 0, 0, w, h, book); return c;
}
export const spineWidth = (book) => (book.pages.length) * (book.paper === 'cream' ? 0.0025 : book.paper === 'color' ? 0.002347 : 0.002252);
export function fullCoverSize(book) {
  const [tw, th] = SIZES[book.size] || SIZES.sq, sp = spineWidth(book);
  return { w: 2 * tw + sp + 2 * BLEED, h: th + 2 * BLEED, spine: sp, tw, th };
}
export async function renderFullCover(book, { dpi = 100 } = {}) {
  const s = fullCoverSize(book), c = canvas(Math.round(s.w * dpi), Math.round(s.h * dpi)), ctx = c.getContext('2d');
  const b = BLEED * dpi, tw = s.tw * dpi, th = s.th * dpi, sp = s.spine * dpi, col = book.coverColor || '#4f46e5';
  const rtl = book.lang === 'ar'; // right-to-left books bind on the right: front cover sits left of the spine
  const backX = rtl ? b + tw + sp : b, frontX = rtl ? b : b + tw + sp, spineX = b + tw;
  ctx.fillStyle = shade(col, -0.45); ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = col; ctx.fillRect(backX - (rtl ? 0 : b), 0, tw + b, c.height);
  drawText(ctx, book.summary || book.subtitle || '', { x: backX + 0.6 * dpi, y: b + 0.9 * dpi, w: tw - 1.2 * dpi, h: th - 2.4 * dpi, vcenter: true }, { lang: book.lang, maxFs: dpi * 0.26, minFs: dpi * 0.14, color: '#fff', align: 'center' });
  ctx.fillStyle = shade(col, -0.2); ctx.fillRect(spineX, 0, sp, c.height);
  if (book.pages.length >= 79 && sp > 0.1 * dpi) { // KDP allows spine text from 79 pages
    ctx.save(); ctx.translate(spineX + sp / 2, c.height / 2); ctx.rotate(Math.PI / 2); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.font = `700 ${Math.min(sp * 0.6, dpi * 0.3)}px ${FONT}`; ctx.fillText(book.title || '', 0, 0); ctx.restore();
  }
  await drawCoverFront(ctx, frontX, b, tw, th, book);
  ctx.fillStyle = col; ctx.fillRect(rtl ? 0 : c.width - b, 0, b, c.height);
  return c;
}
