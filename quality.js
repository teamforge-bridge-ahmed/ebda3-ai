import * as AI from './ai.js';
import { renderPage } from './render.js';
import { uid } from './store.js';

export const needsImage = (p) => (p.kind === 'story' || p.kind === 'image');
export function imgSize(book, page, big = false) {
  const base = big ? 1536 : 1024;
  if (page === 'cover') return { w: Math.round(base * 0.75 / 16) * 16, h: base };
  if (page.kind === 'story') return { w: base, h: Math.round(base * 0.7 / 16) * 16 };
  const [a, b] = ({ sq: [1, 1], us: [8.5, 11], '69': [6, 9], '810': [8, 10], a4: [8.27, 11.69], a5: [5.83, 8.27] })[book.size] || [1, 1];
  return a >= b ? { w: base, h: Math.round(base * b / a / 16) * 16 } : { w: Math.round(base * a / b / 16) * 16, h: base };
}
export async function drawPageImage(book, page, { signal, big = false, onBusy } = {}) {
  const { w, h } = imgSize(book, page, big);
  const prompt = AI.imagePrompt(book, page);
  const seed = book.seed + (book.pages.indexOf(page) + 1) * 7 + (page._try = (page._try || 0) + 1) * 1000;
  const r = await AI.genImage(prompt, { w, h, seed: page._try > 1 ? undefined : seed, signal, onBusy, flatten: book.type === 'coloring' });
  page.image = { dataUrl: r.dataUrl, w: r.w, h: r.h, seed: r.seed, src: r.src };
}
export async function drawCover(book, opt = {}) {
  const { w, h } = imgSize(book, 'cover', opt.big);
  const chars = (book.characters || []).map(c => `${c.name}: ${c.desc}`).join('; ');
  const style = book.type === 'coloring' ? 'bright colorful children book cover illustration, joyful' : (AI.STYLES[book.style] || '');
  const prompt = (book.cover?.prompt || `Book cover art for "${book.idea || book.title}"`) + `. ${chars} ${style}. No text, no letters, no words.`;
  const r = await AI.genImage(prompt.slice(0, 900), { w, h, seed: opt.retry ? undefined : book.seed, signal: opt.signal, onBusy: opt.onBusy });
  book.cover = { ...(book.cover || {}), image: { dataUrl: r.dataUrl, w: r.w, h: r.h } };
}

export async function check(book) {
  const out = [];
  const add = (sev, key, page, fix) => out.push({ id: uid(), sev, key, pageId: page?.id, fix });
  if (!book.title?.trim()) add('error', 'q_notitle', null, null);
  const seen = new Map();
  for (let i = 0; i < book.pages.length; i++) {
    const p = book.pages[i];
    const hasText = !!p.text?.trim(), hasImg = !!p.image;
    if (p.kind === 'blank' || p.kind === 'puzzle') continue;
    if (!hasText && !hasImg && !p.imagePrompt) { add('error', 'q_empty', p, 'delete'); continue; }
    if (needsImage(p) && !hasImg) add('error', 'q_noimg', p, p.imagePrompt ? 'regen' : null);
    if (p.kind === 'text' && !hasText) add('error', 'q_empty', p, 'delete');
    if (p.kind === 'story' && !hasText) add('warn', 'q_empty', p, null);
    const key = p.text?.trim().toLowerCase();
    if (key && key.length > 20) { if (seen.has(key)) add('warn', 'q_dupe', p, null); else seen.set(key, p.id); }
    const c = await renderPage(book, p, { dpi: 60, index: i });
    if (c.meta.overflow) add('error', 'q_overflow', p, 'shorten');
    if (c.meta.lowres) add('warn', 'q_lowres', p, 'regen_big');
  }
  if (book.pages.length < 24) add('warn', 'q_short', null, 'pad');
  else if (book.pages.length % 2) add('warn', 'q_odd', null, 'pad');
  return out;
}

export async function fix(book, issue, o = {}) {
  const p = book.pages.find(x => x.id === issue.pageId);
  switch (issue.fix) {
    case 'regen': await drawPageImage(book, p, o); return true;
    case 'regen_big': await drawPageImage(book, p, { ...o, big: true }); return true;
    case 'delete': book.pages = book.pages.filter(x => x !== p); return true;
    case 'shorten': {
      const t = await AI.chat(`Shorten this text to about 60% of its length, keep the meaning, same language, reply with the text only.`, p.text, o);
      p.text = t.replace(/^["“]|["”]$/g, ''); return true;
    }
    case 'pad': {
      const want = Math.max(24, book.pages.length + (book.pages.length % 2));
      while (book.pages.length < want) book.pages.push({ id: uid(), kind: 'blank', title: '', text: '' });
      return true;
    }
  }
  return false;
}
