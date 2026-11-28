// AI services: free Pollinations text + image endpoints, called from the browser.
// No keys, no payment. Every call can fail; callers must handle errors.
const TEXT_URL = 'https://text.pollinations.ai/';
const IMG_URL = 'https://image.pollinations.ai/prompt/';

// When the fast path is out of quota, drop new requests to 512px: about 3x faster and the A/B showed quality holds.
function lowQuota() { try { const n = Date.now(); return n < Number(localStorage.getItem('ebda3_p_off') || 0) || n < Number(localStorage.getItem('ebda3_z_off') || 0); } catch { return false; } }
function targetMax() { return lowQuota() ? 512 : 768; }

export class AiError extends Error { constructor(m, code) { super(m); this.code = code; } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// One request at a time: the anonymous free tier rejects parallel requests.
let chain = Promise.resolve();
function queued(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
async function fetchRetry(url, opts, { tries = 4, timeout = 90000, onBusy, signal } = {}) {
  let last, waitMs = 0, limited = 0;
  for (let i = 0; i < tries; i++) {
    if (signal?.aborted) throw new AiError('aborted', 'abort');
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), timeout);
    const onAbort = () => ac.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const r = await fetch(url, { ...opts, signal: ac.signal });
      if (r.ok) return r;
      last = new AiError('HTTP ' + r.status, r.status);
      if (r.status === 402 || r.status === 429) { // free-tier rate limit: wait the time the service asks for
        const m = (await r.text().catch(() => '')).match(/wait (\d+) seconds?/i);
        waitMs = ((m ? +m[1] : 20) + 2) * 1000; i--; if (++limited > 8) throw last;
      } else if (r.status < 500) throw last;
    } catch (e) {
      if (signal?.aborted) throw new AiError('aborted', 'abort');
      last = e instanceof AiError ? e : new AiError(e.message || 'network', 'net');
      if (last.code !== 402 && last.code !== 429 && typeof last.code === 'number' && last.code < 500) throw last;
    } finally { clearTimeout(tm); signal?.removeEventListener('abort', onAbort); }
    onBusy?.(i + 1, waitMs / 1000);
    await sleep(waitMs || 3000 * (i + 1)); waitMs = 0;
  }
  throw last || new AiError('failed', 'net');
}

export function chat(system, user, { json = false, signal, onBusy } = {}) {
  return queued(async () => {
    const body = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], model: 'openai', jsonMode: json, seed: Math.floor(Math.random() * 1e6) };
    const r = await fetchRetry(TEXT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { signal, onBusy });
    const txt = (await r.text()).trim();
    if (!txt) throw new AiError('empty', 'empty');
    return txt;
  });
}
export function parseJSON(txt) {
  try { return JSON.parse(txt); } catch {}
  const m = txt.match(/\{[\s\S]*\}/) || txt.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new AiError('bad json', 'json');
}
export async function chatJSON(system, user, opt) {
  let last;
  for (let i = 0; i < 2; i++) {
    try { return parseJSON(await chat(system, user, { ...opt, json: true })); } catch (e) { last = e; if (e.code === 'abort') throw e; }
  }
  throw last;
}

export const STYLES = {
  cartoon: 'colorful cartoon illustration, clean shapes', cute: 'cute kawaii illustration, soft pastel colors, rounded shapes',
  storybook: "children's storybook watercolor illustration, warm", lineart: 'clean black line art illustration',
  minimal: 'minimalist flat vector illustration', realistic: 'realistic detailed illustration', fantasy: 'fantasy digital painting, magical',
  comic: 'comic book illustration, bold ink outlines', edu: 'simple educational illustration, clear and friendly',
  '3d': 'cute 3D rendered illustration, soft lighting', anime: 'anime style illustration, family friendly',
};
const LINE = "coloring book page for kids, bold thick clean black outlines, closed shapes, full scene with characters and props, pure white background, no shading, no gray, no color, no text, vector line art";

export function imagePrompt(book, page, extra = '', fb = false) {
 const chars = (book.characters || []).map(c => c.name + ': ' + c.desc).join('; ');
 const base = page.imagePrompt || page.title || book.title;
 const style = book.type === 'coloring' ? LINE + (book.detail === 'low' ? ', very simple shapes' : book.detail === 'high' ? ', intricate detailed patterns' : '') : (STYLES[book.style] || STYLES.cartoon);
 if (fb) return (base + '. ' + style + '. ' + extra).slice(0, 500);
 return (base + '. ' + (chars ? 'Characters (keep identical): ' + chars + '. ' : '') + style + '. ' + extra).slice(0, 900);
}

// Primary image source: the public Z-Image Turbo Hugging Face Space. Anonymous visitors get a very small daily GPU
// quota per IP; an optional user-owned Hugging Face token (kept in this browser only) gives the free account quota.
// When quota runs out we remember it (30 min anonymous, 10 min with token), say so in the UI and use Pollinations.
const ZHOST = 'https://mrfakename-z-image-turbo.hf.space/gradio_api/call/generate_image';
export function hfToken() { try { return String(JSON.parse(localStorage.getItem('ebda3.hfToken') || '""') || '').trim(); } catch { return ''; } }
export function imgStatus() { try { return JSON.parse(localStorage.getItem('ebda3.imgStatus') || '{}'); } catch { return {}; } }
function setStatus(o) { const s = { ...imgStatus(), ...o, ts: Date.now() }; try { localStorage.setItem('ebda3.imgStatus', JSON.stringify(s)); } catch {} try { window.dispatchEvent(new CustomEvent('ebda3-img', { detail: s })); } catch {} }
const PROXY_URL = 'https://ebda3-proxy.onrender.com/img';
async function viaProxy(prompt, w, h, seed, signal) {
  try { if (Date.now() < Number(localStorage.getItem('ebda3_p_off') || 0)) return null; } catch {}
  const k = targetMax() / Math.max(w, h), W = Math.max(256, Math.round(w * k / 16) * 16), H = Math.max(256, Math.round(h * k / 16) * 16);
  const ac = new AbortController(), onAbort = () => ac.abort(); signal?.addEventListener('abort', onAbort);
  const tm = setTimeout(() => ac.abort(), 120000);
  try {
    let r;
    for (let n = 0; n < 10; n++) {
      r = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, w: W, h: H, seed: seed % 100000 }), signal: ac.signal });
      if (r.status === 429) { const e = await r.clone().json().catch(() => ({})); if (e.error === 'rate' || e.error === 'busy') { await sleep(2000 + n * 1000); continue; } }
      break;
    }
    if (!r.ok) { const e = await r.clone().json().catch(() => ({})); try { localStorage.setItem('ebda3_p_off', String(Date.now() + (e.error === 'ipday' ? 360 : r.status === 429 ? 5 : 2) * 60000)); } catch {} return null; }
    const b = await r.blob(); if (!b.type.startsWith('image/')) return null;
    setStatus({ quota: false, bad: false, down: false, last: 'z-image' }); return b;
  } catch (e) { if (signal?.aborted) throw new AiError('aborted', 'abort'); return null; }
  finally { clearTimeout(tm); signal?.removeEventListener('abort', onAbort); }
}
async function zImage(prompt, w, h, seed, signal) {
  if (!hfToken()) { const pb = await viaProxy(prompt, w, h, seed, signal); if (pb) return pb; }
  try { if (Date.now() < Number(localStorage.getItem('ebda3_z_off') || 0)) return null; } catch {}
  const tk = hfToken(), hd = tk ? { Authorization: 'Bearer ' + tk } : {};
  const k = targetMax() / Math.max(w, h), W = Math.max(256, Math.round(w * k / 16) * 16), H = Math.max(256, Math.round(h * k / 16) * 16);
  const off = (st) => { try { localStorage.setItem('ebda3_z_off', String(Date.now() + (tk ? 10 : 30) * 60000)); } catch {} setStatus(st); return null; };
  const ac = new AbortController(), onAbort = () => ac.abort(); signal?.addEventListener('abort', onAbort);
  const tm = setTimeout(() => ac.abort(), 100000);
  try {
    const r = await fetch(ZHOST, { method: 'POST', headers: { 'Content-Type': 'application/json', ...hd }, body: JSON.stringify({ data: [prompt, H, W, 9, seed % 100000, false] }), signal: ac.signal });
    if (tk && (r.status === 401 || r.status === 403)) return off({ bad: true, quota: false });
    if (!r.ok) return off({ down: true });
    const { event_id } = await r.json();
    const t = await (await fetch(ZHOST + '/' + event_id, { headers: hd, signal: ac.signal })).text();
    const m = t.match(/event: complete\s*\ndata: (.*)/);
    if (!m) return /quota|exceeded/i.test(t) ? off({ quota: true, bad: false, withToken: !!tk }) : /token|unauthor|invalid/i.test(t) && tk ? off({ bad: true }) : null;
    const url = JSON.parse(m[1])[0]?.url; if (!url) return null;
    const ir = await fetch(url, { headers: hd, signal: ac.signal }); if (!ir.ok) return null;
    const b = await ir.blob(); if (!b.type.startsWith('image/')) return null;
    setStatus({ quota: false, bad: false, down: false, last: 'z-image' }); return b;
  } catch (e) { if (signal?.aborted) throw new AiError('aborted', 'abort'); return null; }
  finally { clearTimeout(tm); signal?.removeEventListener('abort', onAbort); }
}
export function genImage(prompt, { w = 1024, h = 1024, seed, signal, onBusy, flatten = false, fb = '' } = {}) {
  return (async () => {
    const s = seed ?? Math.floor(Math.random() * 1e6);
    let blob = null, src = 'pollinations';
    blob = await zImage(prompt, w, h, s, signal); if (blob) src = 'z-image'; else setStatus({ last: 'pollinations' });
    if (!blob) {
      const kk = Math.min(1, targetMax() / Math.max(w, h)), fw = Math.max(256, Math.round(w * kk / 16) * 16), fh = Math.max(256, Math.round(h * kk / 16) * 16);
 const url = IMG_URL + encodeURIComponent(fb || prompt) + '?width=' + fw + '&height=' + fh + '&seed=' + s + '&nologo=true&safe=true';
      const r = await queued(() => fetchRetry(url, {}, { timeout: 120000, signal, onBusy }));
      const type = r.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new AiError('not image', 'bad');
      blob = await r.blob();
    }
    const bmp = await createImageBitmap(blob);
    // The Pollinations free tier burns a small logo into the bottom edge: crop it off (7%). Z-Image has none.
    const ch = src === 'z-image' ? bmp.height : Math.round(bmp.height * 0.93);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, bmp.width, ch, 0, 0, c.width, ch);
    if (flatten) toLineArt(x, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height, seed: s, src };
  })();
}

const LANGN = { ar: 'Arabic', en: 'English', fr: 'French', es: 'Spanish', de: 'German', tr: 'Turkish' };
export const langName = (l) => LANGN[l] || l;

export async function suggest(idea, o = {}) {
  const sys = 'You configure a book-creation tool. Reply with JSON only: {"type":"story|coloring|learn|activity|nonfic|custom","pages":number 8-60,"age":"any|46|48|69|912|teen|adult","lang":"ar|en|fr|es|de|tr","style":"cartoon|cute|storybook|lineart|minimal|realistic|fantasy|comic|edu|3d|anime","detail":"low|mid|high","size":"sq|us|69|810|a4|a5","title":"short title in the book language","author":""}. Use what the user wrote; infer the rest sensibly. Language = the language of the idea unless stated.';
  const j = await chatJSON(sys, idea, o);
  return j;
}

export async function planOutline(idea, o) {
  const { type, pages, age, lang, style, title, author } = o;
  const sys = `You plan a ${type} book. Reply with JSON only: {"title":"","subtitle":"","audience":"","characters":[{"name":"","desc":"<=25 words English visual description: species/age, hair, clothes, colors"}],"summary":"2 sentences"}. Title, subtitle and summary in ${langName(lang)}. Characters only if the book has characters, otherwise []. Keep it age-appropriate for ${age}.`;
  const j = await chatJSON(sys, `Idea: ${idea}\nPages: ${pages}\nTitle given: ${title || '(choose one)'}\nStyle: ${style}`, o);
  return { title: title || j.title, subtitle: j.subtitle || '', audience: j.audience || '', characters: Array.isArray(j.characters) ? j.characters.slice(0, 5) : [], summary: j.summary || '' };
}

export async function planAll(idea, o, from, count, book) {
  const kindRule = KIND_RULE[o.type] || KIND_RULE.custom;
  const sys = `You plan and write a ${o.type} book in one pass. Reply with JSON only: {"title":"","subtitle":"","audience":"","summary":"2 sentences","characters":[{"name":"","desc":"<=25 words English visual description"}],"pages":[{"title":"","text":"","imagePrompt":"","words":[]}]} with exactly ${count} pages. Title, subtitle, summary, page title and text in ${langName(o.lang)}. imagePrompt always in English. Characters only if the book has characters, else []. Age group: ${o.age}. ${kindRule} Use simple, correct Modern Standard Arabic if the language is Arabic. Do not repeat pages.`;
  const j = await chatJSON(sys, `Idea: ${idea}\nTitle given: ${o.title || '(choose one)'}\nTotal pages: ${o.pages}`, o);
  if (!Array.isArray(j.pages) || !j.pages.length) throw new AiError('no pages', 'json');
  return j;
}
const KIND_RULE = {
  story: 'One story across the whole book with a clear beginning, middle and end. text = 2-4 short sentences. imagePrompt = the scene to draw.',
  coloring: 'Each page is a different subject or scene to color. text = "" or a 3-6 word caption. imagePrompt = simple clear subject.',
  learn: 'Each page teaches one item (letter, number, word or concept) with a short friendly explanation and one example. imagePrompt = picture of the example.',
  activity: 'Each page is a themed activity. title = activity name. text = one short instruction. words = 6-8 simple theme words in the book language (single words). imagePrompt = simple theme picture.',
  nonfic: 'Each page is a section. title = heading. text = 80-140 words. imagePrompt = optional illustration or "".',
  custom: 'Follow the idea. text = short paragraph. imagePrompt = scene to draw.',
};
export async function writePages(book, from, count, idea, o = {}) {
  const prev = book.pages.slice(Math.max(1, from - 4), from).map(p => p.title || p.text?.slice(0, 40)).join(' | ');
  const kindRule = KIND_RULE[book.type] || '';
  const _unused = {
    story: 'Each page continues one story with a clear beginning, middle and end across the whole book. text = 2-4 short sentences. imagePrompt = the scene to draw.',
    coloring: 'Each page is a different subject or scene to color. text = "" (empty) or a 3-6 word caption. imagePrompt = a simple clear subject description.',
    learn: 'Each page teaches one item (a letter, number, word or concept) with a short friendly explanation and one example. imagePrompt = a picture of the example.',
    activity: 'Each page is a themed activity. title = activity name. text = one short instruction. words = 6-8 simple theme words in the book language (single words, no spaces). imagePrompt = a simple theme picture.',
    nonfic: 'Each page is a section of a structured book. title = heading. text = 80-140 words. imagePrompt = optional illustration or "".',
    custom: 'Follow the idea. text = short paragraph. imagePrompt = scene to draw.',
  };
  const sys = `You write pages ${from} to ${from + count - 1} of a ${book.type} book titled "${book.title}" (${book.audience}). Book language: ${langName(book.lang)}. ${kindRule} imagePrompt must be in English. Use simple, correct Modern Standard Arabic if the language is Arabic. Do not repeat earlier pages. Reply with JSON only: {"pages":[{"title":"","text":"","imagePrompt":"","words":[]}]} with exactly ${count} pages.`;
  const j = await chatJSON(sys, `Idea: ${idea}\nSummary: ${book.summary}\nCharacters: ${JSON.stringify(book.characters)}\nPrevious pages: ${prev || '(none)'}`, o);
  const arr = Array.isArray(j) ? j : j.pages;
  if (!Array.isArray(arr) || !arr.length) throw new AiError('no pages', 'json');
  return arr.slice(0, count);
}

export async function improveText(text, mode, lang, o) {
  const sys = mode === 'fix'
    ? `Correct spelling and grammar only. Keep wording, meaning and language (${langName(lang)}). Reply with the corrected text only.`
    : `Improve the writing: clearer, more vivid, same meaning, same language (${langName(lang)}), similar length. Reply with the improved text only.`;
  return (await chat(sys, text, o)).replace(/^["“]|["”]$/g, '');
}

// Basic non-AI outline used only when the AI service is unreachable.
export function offlinePlan(idea, o, L) {
  const n = o.pages;
  const ar = o.lang === 'ar';
  const pages = [];
  for (let i = 0; i < n; i++) {
    pages.push({ title: (ar ? 'الصفحة ' : 'Page ') + (i + 1), text: o.type === 'coloring' ? '' : (ar ? 'اكتب نص هذه الصفحة هنا.' : 'Write this page text here.'), imagePrompt: `${idea}, scene ${i + 1}`, words: [] });
  }
  return { title: o.title || idea.slice(0, 40), subtitle: '', audience: o.age, characters: [], summary: idea, pages };
}

// Coloring pages must be black lines on white. Free models often return filled or colored art,
// so: mostly-white images get contrast-cleaned, everything else becomes an outline (Sobel edges).
export function toLineArt(x, w, h) {
  const d = x.getImageData(0, 0, w, h), p = d.data, n = w * h, g = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { g[i] = (p[i * 4] * 0.3 + p[i * 4 + 1] * 0.59 + p[i * 4 + 2] * 0.11); sum += g[i]; }
  const out = new Uint8Array(n);
  if (sum / n > 205) { for (let i = 0; i < n; i++) out[i] = g[i] > 150 ? 255 : 0; }
  else {
    const b = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let k = y * w + 1; k < y * w + w - 1; k++) b[k] = (g[k] * 4 + g[k - 1] + g[k + 1] + g[k - w] + g[k + w]) / 8;
    const b2 = new Float32Array(n); for (let y = 1; y < h - 1; y++) for (let k = y * w + 1; k < y * w + w - 1; k++) b2[k] = (b[k] * 4 + b[k - 1] + b[k + 1] + b[k - w] + b[k + w]) / 8;
    b.set(b2);
    const mag = new Float32Array(n); let mx = 0;
    for (let y = 1; y < h - 1; y++) for (let k = y * w + 1; k < y * w + w - 1; k++) {
      const gx = -b[k - w - 1] - 2 * b[k - 1] - b[k + w - 1] + b[k - w + 1] + 2 * b[k + 1] + b[k + w + 1];
      const gy = -b[k - w - 1] - 2 * b[k - w] - b[k - w + 1] + b[k + w - 1] + 2 * b[k + w] + b[k + w + 1];
      mag[k] = Math.abs(gx) + Math.abs(gy); if (mag[k] > mx) mx = mag[k];
    }
    const th = mx * 0.24; out.fill(255);
    for (let k = 0; k < n; k++) if (mag[k] > th) { out[k] = 0; if (k + 1 < n) out[k + 1] = 0; if (k + w < n) out[k + w] = 0; } // 2px lines
    // drop specks: black pixels with almost no black neighbours; clear a thin frame where vignettes cause noise
    const m = Math.round(Math.min(w, h) * 0.02), keep = new Uint8Array(out);
    for (let y = 1; y < h - 1; y++) for (let k = y * w + 1; k < y * w + w - 1; k++) if (!keep[k]) { let c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = k + dy * w + dx; if (q >= 0 && q < n && !keep[q]) c++; } if (c < 9) out[k] = 255; }
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (y < m || xx < m || y >= h - m || xx >= w - m) out[y * w + xx] = 255;
  }
  for (let i = 0; i < n; i++) { p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = out[i]; p[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0);
}
