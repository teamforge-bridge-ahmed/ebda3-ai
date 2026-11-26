import { t, esc, getLang, setLang, apply } from './i18n.js';
import { projects, gallery, settings, uid } from './store.js';
import * as AI from './ai.js';
import * as Q from './quality.js';
import { renderPage, renderCover, renderFullCover, fullCoverSize, spineWidth, dims, SIZES, BLEED } from './render.js';
import { buildPdf, canvasJpeg } from './pdf.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="64" height="64" rx="17" fill="url(#lg)"/><path d="M13 19h17c3 0 5 2 5 5v23c0-3-2-4-5-4H13zM51 19H34c-3 0-5 2-5 5v23c0-3 2-4 5-4h17z" fill="#fff"/><path d="M47 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fbbf24"/></svg>`;
const TYPES = { story: '📖', coloring: '🎨', learn: '🔤', activity: '🧩', nonfic: '📚', custom: '✨' };
const STYLE_KEYS = Object.keys(AI.STYLES);
const AGES = ['any', '46', '48', '69', '912', 'teen', 'adult'];
const LANGS = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch', tr: 'Türkçe' };

function toast(msg, kind = '') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('#toasts').append(d); setTimeout(() => d.remove(), 4500); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const safeName = (s) => (s || 'book').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'book';
const canvasBlob = (c, type = 'image/png') => new Promise(r => c.toBlob(r, type, 0.95));
const debounce = (f, ms) => { let k; return (...a) => { clearTimeout(k); k = setTimeout(() => f(...a), ms); }; };
const sel = (name, opts, cur, attrs = '') => `<select name="${name}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const sizeOpts = () => Object.keys(SIZES).map(k => [k, t('sz_' + (k === 'sq' ? 'sq' : k))]);
const styleOpts = () => STYLE_KEYS.map(k => [k, t('st_' + k)]);
const ageOpts = () => AGES.map(k => [k, t('ages_' + k)]);

// ---------- shell ----------
function shell(inner, active) {
  const nav = [['home', '#/', 'nav_home'], ['create', '#/create', 'nav_create'], ['tools', '#/tools', 'nav_tools'], ['library', '#/library', 'nav_library'], ['faq', '#/faq', 'nav_faq']];
  app.innerHTML = `<header class="top"><a class="brand" href="#/">${LOGO}<span>${esc(t('brand'))}</span></a>
  <nav>${nav.map(([k, h, l]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${t(l)}</a>`).join('')}</nav>
  <div class="tools"><button class="icon" data-act="lang" title="${t('s_lang')}">${getLang() === 'ar' ? 'EN' : 'ع'}</button>
  <button class="icon" data-act="theme" title="${t('s_theme')}">◐</button><a class="icon" href="#/settings" title="${t('nav_settings')}">⚙</a></div></header>
  <main class="${active}">${inner}</main><footer>${t('footer')}</footer>`;
  $('[data-act=lang]').onclick = () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); route(); };
  $('[data-act=theme]').onclick = () => { settings.set('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); apply(); };
}

// ---------- home ----------
function home() {
  const faq = [1, 2, 3, 4, 5].map(i => `<details><summary>${t('q' + i)}</summary><p>${t('a' + i)}</p></details>`).join('');
  shell(`<section class="hero"><div class="hero-t"><span class="badge">${t('free_badge')}</span><h1>${t('hero_h')}</h1><p>${t('hero_p')}</p>
  <div class="cta"><a class="btn primary" href="#/create">${t('btn_book')}</a><a class="btn" href="#/create?type=story">${t('btn_story')}</a><a class="btn" href="#/create?type=coloring">${t('btn_color')}</a><a class="btn ghost" href="#/tools">${t('btn_tools')}</a></div></div>
  <div class="hero-art" aria-hidden="true"><div class="orb o1"></div><div class="orb o2"></div>
  <svg viewBox="0 0 400 320" class="art"><g class="float"><rect x="70" y="60" width="130" height="180" rx="12" fill="#6366f1"/><rect x="85" y="80" width="100" height="70" rx="8" fill="#fde68a"/><circle cx="135" cy="115" r="20" fill="#f59e0b"/><rect x="90" y="165" width="90" height="8" rx="4" fill="#fff" opacity=".8"/><rect x="90" y="182" width="70" height="8" rx="4" fill="#fff" opacity=".6"/></g>
  <g class="float d2"><rect x="190" y="90" width="130" height="180" rx="12" fill="#a855f7"/><path d="M215 220c20-60 60-80 80-110-5 40 10 70-20 110z" fill="#fff" opacity=".9"/><circle cx="290" cy="120" r="9" fill="#fbbf24"/></g>
  <path d="M330 40l6 14 14 6-14 6-6 14-6-14-14-6 14-6z" fill="#fbbf24" class="twinkle"/></svg></div></section>
  <section><h2>${t('feat_h')}</h2><div class="grid feat">${[['📖', 1], ['🧬', 2], ['📄', 3], ['🛠', 4], ['🔒', 5], ['🌍', 6]].map(([i, n]) => `<div class="card"><div class="ico">${i}</div><h3>${t('f' + n + 't')}</h3><p>${t('f' + n + 'd')}</p></div>`).join('')}</div></section>
  <section><h2>${t('types_h')}</h2><div class="grid types">${Object.keys(TYPES).map(k => `<a class="card type" href="#/create?type=${k}"><div class="ico">${TYPES[k]}</div><h3>${t('t_' + k)}</h3><p>${t('t_' + k + '_d')}</p></a>`).join('')}</div></section>
  <section><h2>${t('how_h')}</h2><ol class="steps">${[1, 2, 3, 4].map(i => `<li><b>${i}</b><span>${t('s' + i)}</span></li>`).join('')}</ol></section>
  <section class="free"><h2>${t('free_h')}</h2><p>${t('free_p')}</p><p class="muted">${t('ex_note')}</p></section>
  <section><h2>${t('faq_h')}</h2><div class="faq">${faq}</div></section>`, 'home');
}
function faq() { shell(`<section><h2>${t('faq_h')}</h2><div class="faq">${[1, 2, 3, 4, 5].map(i => `<details open><summary>${t('q' + i)}</summary><p>${t('a' + i)}</p></details>`).join('')}</div><section class="free"><h2>${t('free_h')}</h2><p>${t('free_p')}</p></section></section>`, 'faq'); }

// ---------- settings ----------
function settingsPage() {
  shell(`<section class="narrow"><h2>${t('s_h')}</h2><div class="card form"><label>${t('s_lang')}</label><div class="seg"><button data-l="ar" class="${getLang() === 'ar' ? 'on' : ''}">العربية</button><button data-l="en" class="${getLang() === 'en' ? 'on' : ''}">English</button></div>
  <label>${t('s_theme')}</label><div class="seg"><button data-th="light">${t('s_light')}</button><button data-th="dark">${t('s_dark')}</button></div></div>
  <div class="card"><h3>${t('s_acct_h')}</h3><p>${t('s_acct_p')}</p><h3>${t('s_priv_h')}</h3><p>${t('s_priv_p')}</p></div>
  <div class="card"><h3>${t('s_data')}</h3><button class="btn danger" id="clr">${t('s_clear')}</button></div></section>`, 'settings');
  $$('[data-l]').forEach(b => b.onclick = () => { setLang(b.dataset.l); route(); });
  $$('[data-th]').forEach(b => b.onclick = () => { settings.set('theme', b.dataset.th); apply(); });
  $('#clr').onclick = async () => { if (!confirm(t('s_clear_c'))) return; for (const p of await projects.all()) await projects.del(p.id); for (const g of await gallery.all()) await gallery.del(g.id); localStorage.clear(); apply(); toast(t('ok')); route(); };
}

// ---------- create ----------
const DEF = { type: 'story', pages: 16, age: '48', lang: 'ar', style: 'cartoon', size: 'sq', detail: 'mid' };
function createPage(q) {
  const v = { ...DEF, lang: getLang() === 'en' ? 'en' : 'ar', ...Object.fromEntries([...q].filter(([k]) => k in DEF || k === 'idea')) };
  if (v.type === 'coloring') { v.style = 'lineart'; v.pages = 20; }
  shell(`<section class="narrow"><h2>${t('c_h')}</h2><form id="cf" class="card form">
  <label>${t('c_idea')}</label><textarea name="idea" rows="4" placeholder="${esc(t('c_idea_ph'))}" required>${esc(v.idea || '')}</textarea>
  <div class="row"><button type="button" class="btn" id="sg">✨ ${t('c_suggest')}</button><span class="muted" id="sgm">${t('c_hint')}</span></div>
  <label>${t('c_type')}</label><div class="typepick">${Object.keys(TYPES).map(k => `<label class="chip"><input type="radio" name="type" value="${k}" ${k === v.type ? 'checked' : ''}><span>${TYPES[k]} ${t('t_' + k)}</span></label>`).join('')}</div>
  <div class="cols"><div><label>${t('c_pages')}</label><input type="number" name="pages" min="4" max="120" value="${v.pages}"></div>
  <div><label>${t('c_age')}</label>${sel('age', ageOpts(), v.age)}</div>
  <div><label>${t('c_lang')}</label>${sel('lang', Object.entries(LANGS), v.lang)}</div>
  <div><label>${t('c_style')}</label>${sel('style', styleOpts(), v.style)}</div>
  <div><label>${t('c_size')}</label>${sel('size', sizeOpts(), v.size)}</div>
  <div><label>${t('c_detail')}</label>${sel('detail', [['low', t('d_low')], ['mid', t('d_mid')], ['high', t('d_high')]], v.detail)}</div>
  <div><label>${t('c_title')}</label><input name="title"></div><div><label>${t('c_author')}</label><input name="author"></div></div>
  <button class="btn primary big" type="submit">${t('c_go')}</button></form><div id="prog"></div></section>`, 'create');
  const f = $('#cf');
  $('#sg').onclick = async () => {
    const idea = f.idea.value.trim(); if (!idea) { f.idea.focus(); return; }
    $('#sgm').textContent = t('loading');
    try {
      const j = await AI.suggest(idea);
      const set = (n, val, ok) => { if (val != null && (!ok || ok.includes(String(val)))) f[n].value = val; };
      if (j.type in TYPES) { const r = $(`input[name=type][value=${j.type}]`, f); if (r) r.checked = true; }
      set('pages', Math.min(60, Math.max(4, +j.pages || 16))); set('age', j.age, AGES); set('lang', j.lang, Object.keys(LANGS)); set('style', j.style, STYLE_KEYS); set('size', j.size, Object.keys(SIZES)); set('detail', j.detail, ['low', 'mid', 'high']);
      if (j.title) f.title.value = j.title;
      $('#sgm').textContent = '✓';
    } catch { $('#sgm').textContent = t('err_net'); }
  };
  f.onsubmit = (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); d.pages = Math.min(120, Math.max(4, +d.pages || 16)); f.hidden = true; runCreate(d); };
}

function newBook(d) {
  return { id: uid(), type: d.type, idea: d.idea, title: d.title || '', subtitle: '', author: d.author || '', lang: d.lang, style: d.style, detail: d.detail, age: d.age, audience: '', size: d.size, paper: 'white', bleed: false, coverColor: ['#4f46e5', '#0f766e', '#be185d', '#b45309', '#1d4ed8'][Math.floor(Math.random() * 5)], characters: [], summary: '', pages: [], cover: null, seed: Math.floor(Math.random() * 90000) + 1000, created: Date.now() };
}
const ACT = ['maze', 'wordsearch', 'trace', 'math', 'image'];
function mkPage(book, i, p) {
  const id = uid(), base = { id, title: p.title || '', text: p.text || '', imagePrompt: p.imagePrompt || '', image: null };
  if (book.type === 'coloring') return { ...base, kind: 'image' };
  if (book.type === 'activity') {
    const k = ACT[i % ACT.length];
    if (k === 'image') return { ...base, kind: 'image', text: '' };
    const ar = book.lang === 'ar';
    const words = (p.words && p.words.length ? p.words : String(book.idea).split(/[\s,،]+/).filter(w => w.length > 2)).map(String);
    return { ...base, kind: 'puzzle', imagePrompt: '', puzzle: { type: k, seed: book.seed + i * 131, words, level: 1, chars: k === 'trace' ? (ar ? 'أبتثجحخ'.slice((i % 4), (i % 4) + 3) : 'ABCDEF'.slice((i % 4), (i % 4) + 3)) : '' } };
  }
  if (book.type === 'nonfic') return { ...base, kind: p.imagePrompt ? 'story' : 'text' };
  return { ...base, kind: 'story' };
}
async function runCreate(d) {
  const ac = new AbortController(), prog = $('#prog'), book = newBook(d);
  const steps = ['p_plan', 'p_write', 'p_images', 'p_cover', 'p_qa'];
  const st = Object.fromEntries(steps.map(s => [s, '']));
  let msg = '', open = false;
  const draw = () => {
    prog.innerHTML = `<div class="card prog"><ul>${steps.map(s => `<li class="${st[s]}"><i></i>${t(s)}${st[s] === 'run' && s === 'p_images' ? ` <b>${book.pages.filter(p => p.image).length}/${book.pages.filter(Q.needsImage).length}</b>` : ''}</li>`).join('')}</ul>
    <div class="msg">${esc(msg)}</div><div class="row"><button class="btn danger" id="stop">${t('p_stop')}</button>${open ? `<a class="btn primary" href="#/book/${book.id}">${t('lib_open')}</a>` : ''}</div></div>`;
    $('#stop').onclick = () => { ac.abort(); };
  };
  const busy = (n, sec) => { msg = t('err_busy') + (sec ? ` (${Math.round(sec)}s)` : ''); draw(); };
  const save = () => projects.put(book);
  const opt = { signal: ac.signal, onBusy: busy };
  let fell = false;
  draw();
  try {
    st.p_plan = 'run'; draw();
    let got = null;
    try { got = await AI.planAll(d.idea, { ...d, signal: ac.signal, onBusy: busy }, 0, Math.min(d.pages, 20), book); } catch (e) { if (ac.signal.aborted) throw e; }
    if (got) {
      Object.assign(book, { title: d.title || got.title, subtitle: got.subtitle || '', audience: got.audience || '', characters: Array.isArray(got.characters) ? got.characters.slice(0, 5) : [], summary: got.summary || '' });
      st.p_plan = 'ok'; st.p_write = 'run'; draw();
      got.pages.slice(0, d.pages).forEach((p, k) => book.pages.push(mkPage(book, k, p)));
      while (book.pages.length < d.pages) {
        const n = Math.min(20, d.pages - book.pages.length), from = book.pages.length;
        try { const arr = await AI.writePages(book, from, n, d.idea, opt); arr.forEach((p, k) => book.pages.push(mkPage(book, from + k, p))); if (!arr.length) break; } catch (e) { if (ac.signal.aborted) throw e; fell = true; break; }
      }
    } else { fell = true; const o = AI.offlinePlan(d.idea, d); Object.assign(book, { title: o.title, summary: o.summary }); st.p_plan = 'ok'; st.p_write = 'run'; }
    if (fell || book.pages.length < d.pages) {
      fell = true; const o = AI.offlinePlan(d.idea, d);
      for (let i = book.pages.length; i < d.pages; i++) book.pages.push(mkPage(book, i, o.pages[i]));
      msg = t('p_fallback');
    }
    await save(); st.p_write = 'ok'; st.p_images = 'run'; open = true; draw();
    let failed = 0;
    for (const p of book.pages.filter(Q.needsImage)) {
      try { await Q.drawPageImage(book, p, opt); msg = ''; await save(); } catch (e) { if (ac.signal.aborted) throw e; failed++; }
      draw();
    }
    if (failed) msg = (msg ? msg + ' ' : '') + t('p_img_fail', { n: failed });
    st.p_images = failed ? 'warn' : 'ok'; st.p_cover = 'run'; draw();
    book.cover = { prompt: `${book.title}. ${book.summary || d.idea}` };
    try { await Q.drawCover(book, opt); } catch (e) { if (ac.signal.aborted) throw e; st.p_cover = 'warn'; }
    if (st.p_cover === 'run') st.p_cover = 'ok';
    await save(); st.p_qa = 'run'; draw();
    const issues = await Q.check(book);
    st.p_qa = issues.some(i => i.sev === 'error') ? 'warn' : 'ok'; draw();
    await save(); location.hash = `#/book/${book.id}`;
  } catch (e) {
    await save().catch(() => {});
    msg = ac.signal.aborted ? t('p_stop') : t('err_net'); open = book.pages.length > 0; draw();
  }
}

// ---------- library ----------
async function library() {
  shell(`<section><div class="row between"><h2>${t('lib_h')}</h2><label class="btn">${t('lib_import')}<input type="file" id="imp" accept=".json,application/json" hidden></label></div><div id="pl" class="grid proj"><div class="skeleton"></div><div class="skeleton"></div></div>
  <h2>${t('lib_gallery')}</h2><div id="gl" class="grid gal"></div></section>`, 'library');
  const list = (await projects.all()).sort((a, b) => b.updated - a.updated);
  $('#pl').innerHTML = list.length ? list.map(p => `<div class="card proj" data-id="${p.id}"><div class="thumb" style="background:${p.coverColor}">${p.cover?.image ? `<img src="${p.cover.image.dataUrl}" alt="">` : TYPES[p.type] || '📖'}</div>
  <h3>${esc(p.title || t('unnamed'))}</h3><p class="muted">${t('t_' + p.type)} · ${p.pages.length} ${t('lib_pages')} · ${new Date(p.updated).toLocaleDateString(getLang())}</p>
  <div class="row"><a class="btn primary sm" href="#/book/${p.id}">${t('lib_open')}</a><button class="btn sm" data-dup>${t('lib_dup')}</button><button class="btn sm" data-exp>⇩</button><button class="btn danger sm" data-del>${t('lib_del')}</button></div></div>`).join('') : `<div class="empty card"><p>${t('lib_empty')}</p><a class="btn primary" href="#/create">${t('btn_book')}</a></div>`;
  $$('.proj[data-id]').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('[data-del]').onclick = async () => { if (confirm(t('lib_confirm'))) { await projects.del(id); library(); } };
    el.querySelector('[data-dup]').onclick = async () => { const p = await projects.get(id); p.id = uid(); p.title += ' (2)'; p.pages.forEach(x => x.id = uid()); await projects.put(p); library(); };
    el.querySelector('[data-exp]').onclick = async () => { const p = await projects.get(id); download(new Blob([JSON.stringify(p)], { type: 'application/json' }), safeName(p.title) + '.ebda3.json'); };
  });
  $('#imp').onchange = async (e) => { try { const p = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(p.pages) || !p.type) throw 0; p.id = uid(); await projects.put(p); library(); } catch { toast(t('err_net'), 'err'); } };
  const gl = (await gallery.all()).sort((a, b) => b.ts - a.ts);
  $('#gl').innerHTML = gl.length ? gl.map(g => `<figure class="card g" data-g="${g.id}"><img src="${g.dataUrl}" alt="${esc(g.prompt)}"><figcaption>${esc(g.prompt.slice(0, 60))}</figcaption><div class="row"><button class="btn sm" data-gd>${t('i_dl')}</button><button class="btn danger sm" data-gx>✕</button></div></figure>`).join('') : '';
  $$('[data-g]').forEach(el => { const g = gl.find(x => x.id === el.dataset.g);
    el.querySelector('[data-gd]').onclick = async () => download(await (await fetch(g.dataUrl)).blob(), 'drawing.jpg');
    el.querySelector('[data-gx]').onclick = async () => { await gallery.del(g.id); library(); }; });
}

// ---------- tools ----------
function toolsHome() {
  const items = [['illus', '🖌', 'tl_illus'], ['cover', '📕', 'tl_cover'], ['puzzle', '🧩', 'tl_puzzle'], ['text', '✍️', 'tl_text']];
  shell(`<section><h2>${t('tools_h')}</h2><div class="grid types">${items.map(([k, i, l]) => `<a class="card type" href="#/tools/${k}"><div class="ico">${i}</div><h3>${t(l)}</h3><p>${t(l + '_d')}</p></a>`).join('')}<a class="card type" href="#/create?type=story"><div class="ico">📖</div><h3>${t('btn_story')}</h3><p>${t('t_story_d')}</p></a></div></section>`, 'tools');
}
function toolPage(k) {
  const back = `<a class="muted" href="#/tools">← ${t('back')}</a>`;
  if (k === 'illus') {
    shell(`<section class="narrow">${back}<h2>${t('tl_illus')}</h2><div class="card form"><label>${t('i_prompt')}</label><textarea id="ip" rows="3"></textarea>
    <div class="cols"><div><label>${t('i_mode')}</label>${sel('m', [['color', t('i_m_color')], ['line', t('i_m_line')]], 'color', 'id=im')}</div><div><label>${t('c_style')}</label>${sel('s', styleOpts(), 'cartoon', 'id=is')}</div><div><label>${t('i_shape')}</label>${sel('sh', [['sq', t('i_sq')], ['p', t('i_port')], ['l', t('i_land')]], 'sq', 'id=ish')}</div></div>
    <button class="btn primary" id="go">${t('i_make')}</button></div><div id="out"></div></section>`, 'tools');
    let last = null;
    $('#go').onclick = async () => {
      const p = $('#ip').value.trim(); if (!p) return; const out = $('#out'); out.innerHTML = '<div class="skeleton big"></div>'; $('#go').disabled = true;
      const sh = $('#ish').value, w = sh === 'l' ? 1024 : sh === 'p' ? 768 : 1024, h = sh === 'p' ? 1024 : sh === 'l' ? 768 : 1024, line = $('#im').value === 'line';
      const full = `${p}. ${line ? 'black and white coloring page, clean thick outlines, white background, no shading' : AI.STYLES[$('#is').value]}`;
      try { const r = await AI.genImage(full, { w, h, flatten: line, onBusy: () => out.insertAdjacentHTML('beforeend', `<p class="muted">${t('err_busy')}</p>`) }); last = { id: uid(), prompt: p, dataUrl: r.dataUrl, ts: Date.now() };
        out.innerHTML = `<div class="card"><img class="result" src="${r.dataUrl}" alt=""><div class="row"><button class="btn primary" id="sv">${t('i_save')}</button><button class="btn" id="dl">${t('i_dl')}</button></div></div>`;
        $('#sv').onclick = async () => { await gallery.put(last); toast(t('e_saved')); }; $('#dl').onclick = async () => download(await (await fetch(last.dataUrl)).blob(), 'drawing.jpg');
      } catch { out.innerHTML = `<p class="err">${t('err_net')}</p>`; }
      $('#go').disabled = false;
    };
  } else if (k === 'cover') {
    shell(`<section class="narrow">${back}<h2>${t('tl_cover')}</h2><div class="card form"><div class="cols"><div><label>${t('e_title')}</label><input id="ct"></div><div><label>${t('e_subtitle')}</label><input id="cs"></div><div><label>${t('e_author')}</label><input id="ca"></div><div><label>${t('e_color')}</label><input type="color" id="cc" value="#4f46e5"></div><div><label>${t('c_size')}</label>${sel('z', sizeOpts(), '69', 'id=cz')}</div><div><label>${t('c_lang')}</label>${sel('l', Object.entries(LANGS), getLang(), 'id=cl')}</div></div>
    <label>${t('i_prompt')}</label><textarea id="cp" rows="2"></textarea><div class="row"><button class="btn primary" id="go">${t('i_make')}</button><button class="btn" id="dl" disabled>${t('i_dl')}</button></div></div><div class="card"><canvas id="cv" class="prev"></canvas></div></section>`, 'tools');
    const tmp = { size: '69', lang: 'ar', title: '', cover: null, pages: [] }; const draw = async () => { Object.assign(tmp, { title: $('#ct').value, subtitle: $('#cs').value, author: $('#ca').value, coverColor: $('#cc').value, size: $('#cz').value, lang: $('#cl').value }); const c = await renderCover(tmp, { dpi: 80 }); const cv = $('#cv'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); };
    $$('input,select').forEach(e => e.oninput = debounce(draw, 150)); draw();
    $('#go').onclick = async () => { const p = $('#cp').value.trim() || $('#ct').value.trim(); if (!p) return; $('#go').disabled = true; try { const { w, h } = Q.imgSize(tmp, 'cover'); const r = await AI.genImage(p + '. book cover illustration, no text, no letters', { w, h }); tmp.cover = { image: r }; await draw(); } catch { toast(t('err_net'), 'err'); } $('#go').disabled = false; };
    $('#dl').disabled = false; $('#dl').onclick = async () => { await draw(); download(await canvasBlob(await renderCover(tmp, { dpi: 300 })), 'cover.png'); };
  } else if (k === 'puzzle') {
    shell(`<section class="narrow">${back}<h2>${t('tl_puzzle')}</h2><div class="card form"><div class="cols"><div><label>${t('pz_type')}</label>${sel('t', [['maze', t('pz_maze')], ['wordsearch', t('pz_ws')], ['mandala', t('pz_mandala')], ['trace', t('pz_trace')], ['math', t('pz_math')]], 'maze', 'id=pt')}</div>
    <div><label>${t('pz_size')}</label>${sel('l', [[0, t('d_low')], [1, t('d_mid')], [2, t('d_high')]], 1, 'id=pl')}</div><div><label>${t('c_lang')}</label>${sel('g', [['ar', 'العربية'], ['en', 'English']], getLang(), 'id=pg')}</div></div>
    <div id="pw"><label>${t('pz_words')}</label><input id="pwo" placeholder="space, rocket, star, moon"></div><div id="pc" hidden><label>${t('pz_chars')}</label><input id="pch" value="A B C"></div>
    <div class="row"><button class="btn primary" id="go">${t('pz_make')}</button><button class="btn" id="png">PNG</button><button class="btn" id="pdf">PDF</button></div></div><div class="card"><canvas id="cv" class="prev"></canvas></div></section>`, 'tools');
    let seed = 1234; const mk = () => ({ size: 'us', lang: $('#pg').value, type: 'activity', pages: [] });
    const page = () => ({ kind: 'puzzle', title: ({ maze: t('pz_maze'), wordsearch: t('pz_ws'), mandala: t('pz_mandala'), trace: t('pz_trace'), math: t('pz_math') })[$('#pt').value], text: '', puzzle: { type: $('#pt').value, seed, level: +$('#pl').value, words: $('#pwo').value.split(/[,،\n]+/), chars: $('#pch').value } });
    const draw = async () => { const t0 = $('#pt').value; $('#pw').hidden = t0 !== 'wordsearch'; $('#pc').hidden = t0 !== 'trace'; const c = await renderPage(mk(), page(), { dpi: 70 }); const cv = $('#cv'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); };
    $$('input,select').forEach(e => e.oninput = debounce(draw, 200)); $('#go').onclick = () => { seed = Math.floor(Math.random() * 1e6); draw(); }; draw();
    $('#png').onclick = async () => download(await canvasBlob(await renderPage(mk(), page(), { dpi: 300 })), 'activity.png');
    $('#pdf').onclick = async () => { const c = await renderPage(mk(), page(), { dpi: 200 }); download(buildPdf([{ bytes: await canvasJpeg(c), w: c.width, h: c.height, wIn: 8.5, hIn: 11 }], 'Activity'), 'activity.pdf'); };
  } else if (k === 'text') {
    shell(`<section class="narrow">${back}<h2>${t('tl_text')}</h2><div class="card form"><label>${t('tx_in')}</label><textarea id="ti" rows="6"></textarea><div class="cols"><div>${sel('l', Object.entries(LANGS), getLang(), 'id=tl')}</div></div><div class="row"><button class="btn primary" id="im">${t('e_improve')}</button><button class="btn" id="fx">${t('e_fix')}</button></div></div><div id="out"></div></section>`, 'tools');
    const run = (mode) => async () => { const v = $('#ti').value.trim(); if (!v) return; const out = $('#out'); out.innerHTML = '<div class="skeleton"></div>'; try { const r = await AI.improveText(v, mode, $('#tl').value); out.innerHTML = `<div class="card"><h3>${t('tx_out')}</h3><div class="pre" dir="auto">${esc(r)}</div><button class="btn" id="cp">${t('tx_copy')}</button></div>`; $('#cp').onclick = () => navigator.clipboard?.writeText(r).then(() => toast(t('ok'))); } catch { out.innerHTML = `<p class="err">${t('err_net')}</p>`; } };
    $('#im').onclick = run('improve'); $('#fx').onclick = run('fix');
  } else toolsHome();
}

// ---------- editor ----------
let B = null, selIdx = 0, tab = 'page', token = 0, issues = [];
async function editor(id) {
  B = await projects.get(id);
  if (!B) { shell(`<section><p>${t('not_found')}</p></section>`, 'library'); return; }
  selIdx = 0; tab = 'page'; issues = [];
  shell(`<div class="ed"><aside class="strip" id="strip"></aside><div class="stage"><div class="stage-top"><a class="muted" href="#/library">← ${t('nav_library')}</a><b id="ttl"></b><span class="muted" id="sv"></span></div><div class="canvas-wrap"><canvas id="pv"></canvas></div></div><aside class="insp"><div class="tabs">${['page', 'book', 'quality', 'export'].map(k => `<button data-tab="${k}">${t('e_' + k)}</button>`).join('')}</div><div id="ip" class="ipane"></div></aside></div>`, 'editor');
  $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; inspector(); });
  buildStrip(); redraw(); inspector();
}
const saveSoon = debounce(async () => { await projects.put(B); const s = $('#sv'); if (s) { s.textContent = '✓ ' + t('e_saved'); } }, 500);
const pageAt = () => selIdx === -1 ? null : B.pages[selIdx];
async function thumb(i) {
  const el = $(`[data-i="${i}"] canvas`); if (!el) return;
  const c = i === -1 ? await renderCover(B, { dpi: 22 }) : await renderPage(B, B.pages[i], { dpi: 22, index: i });
  el.width = c.width; el.height = c.height; el.getContext('2d').drawImage(c, 0, 0);
}
function buildStrip() {
  $('#ttl').textContent = B.title || t('unnamed');
  $('#strip').innerHTML = [-1, ...B.pages.keys()].map(i => `<button class="th ${i === selIdx ? 'on' : ''}" data-i="${i}"><canvas></canvas><span>${i === -1 ? t('l_cover') : i + 1}</span></button>`).join('');
  $$('.th').forEach(b => b.onclick = () => { selIdx = +b.dataset.i; $$('.th').forEach(x => x.classList.toggle('on', x === b)); redraw(); inspector(); });
  (async () => { for (const i of [-1, ...B.pages.keys()]) await thumb(i); })();
}
async function redraw() {
  const my = ++token, wrap = $('.canvas-wrap'); if (!wrap) return;
  const tw = SIZES[B.size][0], avail = Math.min(wrap.clientWidth - 20, 760), dpi = Math.max(40, avail / tw);
  const c = selIdx === -1 ? await renderCover(B, { dpi }) : await renderPage(B, pageAt(), { dpi, index: selIdx });
  if (my !== token) return;
  const pv = $('#pv'); pv.width = c.width; pv.height = c.height; pv.getContext('2d').drawImage(c, 0, 0);
  pv.title = c.meta?.overflow ? t('q_overflow') : '';
  pv.classList.toggle('warn', !!c.meta?.overflow);
}
const changed = (full) => { saveSoon(); redraw(); thumb(selIdx); if (full) buildStrip(); };
async function withBusy(btn, fn) { const o = btn.textContent; btn.disabled = true; btn.textContent = t('x_working'); try { await fn(); } catch (e) { toast(t('err_net'), 'err'); } btn.disabled = false; btn.textContent = o; }

function inspector() {
  $$('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const el = $('#ip');
  if (tab === 'page') return selIdx === -1 ? coverPane(el) : pagePane(el);
  if (tab === 'book') return bookPane(el);
  if (tab === 'quality') return qualityPane(el);
  exportPane(el);
}
function bind(el, sels) { for (const [s, fn] of Object.entries(sels)) { const n = $(s, el); if (n) n[n.tagName === 'BUTTON' ? 'onclick' : 'oninput'] = fn; } }
function coverPane(el) {
  el.innerHTML = `<label>${t('e_title')}</label><input id="a" value="${esc(B.title)}"><label>${t('e_subtitle')}</label><input id="b" value="${esc(B.subtitle)}"><label>${t('e_author')}</label><input id="c" value="${esc(B.author)}">
  <label>${t('e_color')}</label><input type="color" id="d" value="${B.coverColor}"><label>${t('e_prompt')}</label><textarea id="e" rows="3">${esc(B.cover?.prompt || '')}</textarea>
  <button class="btn primary" id="r">${t('e_cover_regen')}</button><label class="btn">${t('e_upload')}<input type="file" id="u" accept="image/*" hidden></label>`;
  bind(el, { '#a': e => { B.title = e.target.value; $('#ttl').textContent = B.title; changed(); }, '#b': e => { B.subtitle = e.target.value; changed(); }, '#c': e => { B.author = e.target.value; changed(); }, '#d': e => { B.coverColor = e.target.value; changed(); }, '#e': e => { (B.cover ||= {}).prompt = e.target.value; saveSoon(); },
    '#r': e => withBusy(e.target, async () => { await Q.drawCover(B, { retry: true }); changed(); }) });
  $('#u', el).onchange = (e) => uploadInto(e.target.files[0], (img) => { (B.cover ||= {}).image = img; changed(); });
}
async function uploadInto(file, set) {
  if (!file) return; const bmp = await createImageBitmap(file), s = Math.min(1, 2048 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); set({ dataUrl: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height });
}
function pagePane(el) {
  const p = pageAt(); if (!p) return;
  const kinds = [['story', t('l_story')], ['image', t('l_image')], ['text', t('l_text')], ['puzzle', t('l_puzzle')], ['blank', t('l_blank')]];
  const z = p.puzzle || {};
  el.innerHTML = `<label>${t('e_layout')}</label>${sel('k', kinds, p.kind, 'id=k')}
  <label>${t('e_title')}</label><input id="t" value="${esc(p.title)}">
  <label>${t('e_text')}</label><textarea id="x" rows="6" dir="auto">${esc(p.text)}</textarea>
  <div class="row"><button class="btn sm" id="im">${t('e_improve')}</button><button class="btn sm" id="fx">${t('e_fix')}</button></div>
  <label>${t('e_fontsize')}</label><input type="range" id="fs" min="0" max="60" value="${p.fontSize || 0}">
  ${p.kind === 'puzzle' ? `<label>${t('pz_type')}</label>${sel('pt', [['maze', t('pz_maze')], ['wordsearch', t('pz_ws')], ['mandala', t('pz_mandala')], ['trace', t('pz_trace')], ['math', t('pz_math')]], z.type, 'id=pt')}<label>${t('pz_words')}</label><input id="pw" value="${esc((z.words || []).join(', '))}"><label>${t('pz_chars')}</label><input id="pc" value="${esc(z.chars || '')}"><button class="btn sm" id="ps">${t('pz_make')}</button>` : `
  <label>${t('e_prompt')}</label><textarea id="ipr" rows="3">${esc(p.imagePrompt)}</textarea>
  <div class="row"><button class="btn primary sm" id="rg">${t('e_regen')}</button><label class="btn sm">${t('e_upload')}<input type="file" id="up" accept="image/*" hidden></label><button class="btn sm" id="ri">${t('e_remove_img')}</button></div>`}
  <div class="row"><button class="btn sm" id="mu">↑ ${t('e_up')}</button><button class="btn sm" id="md">↓ ${t('e_down')}</button><button class="btn sm" id="ad">+ ${t('e_add')}</button><button class="btn danger sm" id="dl">${t('e_del')}</button></div>`;
  bind(el, {
    '#k': e => { p.kind = e.target.value; if (p.kind === 'puzzle' && !p.puzzle) p.puzzle = { type: 'maze', seed: B.seed + selIdx, level: 1, words: [], chars: '' }; changed(); inspector(); },
    '#t': e => { p.title = e.target.value; changed(); }, '#x': e => { p.text = e.target.value; changed(); }, '#fs': e => { p.fontSize = +e.target.value || 0; changed(); },
    '#ipr': e => { p.imagePrompt = e.target.value; saveSoon(); },
    '#pt': e => { z.type = e.target.value; changed(); }, '#pw': e => { z.words = e.target.value.split(/[,،]+/).map(s => s.trim()).filter(Boolean); changed(); }, '#pc': e => { z.chars = e.target.value; changed(); }, '#ps': () => { z.seed = Math.floor(Math.random() * 1e6); changed(); },
    '#rg': e => withBusy(e.target, async () => { await Q.drawPageImage(B, p); changed(); }), '#ri': () => { p.image = null; changed(); },
    '#im': e => withBusy(e.target, async () => { p.text = await AI.improveText(p.text, 'improve', B.lang); changed(); inspector(); }), '#fx': e => withBusy(e.target, async () => { p.text = await AI.improveText(p.text, 'fix', B.lang); changed(); inspector(); }),
    '#mu': () => { if (selIdx > 0) { [B.pages[selIdx - 1], B.pages[selIdx]] = [B.pages[selIdx], B.pages[selIdx - 1]]; selIdx--; saveSoon(); buildStrip(); redraw(); inspector(); } },
    '#md': () => { if (selIdx < B.pages.length - 1) { [B.pages[selIdx + 1], B.pages[selIdx]] = [B.pages[selIdx], B.pages[selIdx + 1]]; selIdx++; saveSoon(); buildStrip(); redraw(); inspector(); } },
    '#ad': () => { B.pages.splice(selIdx + 1, 0, { id: uid(), kind: 'story', title: '', text: '', imagePrompt: '', image: null }); selIdx++; saveSoon(); buildStrip(); redraw(); inspector(); },
    '#dl': () => { if (B.pages.length <= 1) return; B.pages.splice(selIdx, 1); selIdx = Math.max(0, selIdx - 1); saveSoon(); buildStrip(); redraw(); inspector(); },
  });
  const up = $('#up', el); if (up) up.onchange = (e) => uploadInto(e.target.files[0], img => { p.image = img; if (p.kind === 'text') p.kind = 'story'; changed(); });
}
function bookPane(el) {
  el.innerHTML = `<label>${t('c_size')}</label>${sel('s', sizeOpts(), B.size, 'id=s')}<label>${t('e_paper')}</label>${sel('p', [['white', t('paper_white')], ['cream', t('paper_cream')], ['color', t('paper_color')]], B.paper, 'id=p')}
  <label class="chip"><input type="checkbox" id="bl" ${B.bleed ? 'checked' : ''}><span>${t('e_bleed')}</span></label><label>${t('c_style')}</label>${sel('st', styleOpts(), B.style, 'id=st')}
  <label>${t('c_lang')}</label>${sel('l', Object.entries(LANGS), B.lang, 'id=l')}
  <label>${t('e_chars')}</label><textarea id="ch" rows="5" placeholder="Name: description">${esc((B.characters || []).map(c => `${c.name}: ${c.desc}`).join('\n'))}</textarea>`;
  bind(el, { '#s': e => { B.size = e.target.value; changed(true); }, '#p': e => { B.paper = e.target.value; saveSoon(); }, '#bl': e => { B.bleed = e.target.checked; saveSoon(); }, '#st': e => { B.style = e.target.value; saveSoon(); }, '#l': e => { B.lang = e.target.value; changed(true); },
    '#ch': e => { B.characters = e.target.value.split('\n').map(l => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i).trim(), desc: l.slice(i + 1).trim() } : null; }).filter(Boolean); saveSoon(); } });
  $('#bl', el).onchange = e => { B.bleed = e.target.checked; saveSoon(); };
}
let qBusy = false;
async function qualityPane(el) {
  const draw = () => {
    el.innerHTML = `<div class="row"><button class="btn primary" id="run">${t('q_run')}</button>${issues.length ? `<button class="btn" id="all">${t('q_fixall')}</button>` : ''}<button class="btn" id="gm">${t('e_gen_missing')}</button></div>
    <p class="muted">${issues.length ? issues.length + ' ' + t('q_found') : ''}</p><ul class="issues">${issues.map(i => `<li class="${i.sev}"><span>${i.pageId ? t('e_page') + ' ' + (B.pages.findIndex(p => p.id === i.pageId) + 1) + ': ' : ''}${t(i.key)}</span>${i.fix ? `<button class="btn sm" data-f="${i.id}">${t('q_fix')}</button>` : `<em>${t('q_manual')}</em>`}${i.pageId ? `<button class="btn sm" data-go="${i.pageId}">→</button>` : ''}</li>`).join('')}</ul>`;
    $('#run', el).onclick = e => withBusy(e.target, async () => { issues = await Q.check(B); if (!issues.length) toast(t('q_ok')); draw(); });
    $('#gm', el).onclick = e => withBusy(e.target, async () => { for (const p of B.pages.filter(x => Q.needsImage(x) && !x.image)) { await Q.drawPageImage(B, p); await projects.put(B); } buildStrip(); redraw(); });
    const all = $('#all', el); if (all) all.onclick = e => withBusy(e.target, async () => { for (const i of [...issues].filter(x => x.fix)) { try { await Q.fix(B, i); } catch {} } await projects.put(B); issues = await Q.check(B); buildStrip(); redraw(); draw(); });
    $$('[data-f]', el).forEach(b => b.onclick = () => withBusy(b, async () => { await Q.fix(B, issues.find(x => x.id === b.dataset.f)); await projects.put(B); issues = await Q.check(B); buildStrip(); redraw(); draw(); }));
    $$('[data-go]', el).forEach(b => b.onclick = () => { selIdx = B.pages.findIndex(p => p.id === b.dataset.go); tab = 'page'; buildStrip(); redraw(); inspector(); });
  };
  draw();
}
function exportPane(el) {
  const fc = fullCoverSize(B), n = B.pages.length;
  el.innerHTML = `<div class="stack"><button class="btn primary" data-x="book">${t('x_book')}</button><button class="btn primary" data-x="print">${t('x_print')}</button><button class="btn" data-x="cover">${t('x_cover')}</button><button class="btn" data-x="full">${t('x_full')}</button><button class="btn" data-x="png">${t('x_png')}</button><button class="btn" data-x="json">${t('x_json')}</button></div>
  <div class="card kdp"><h3>${t('x_kdp_h')}</h3><p class="muted">${t('x_kdp_note')}</p><dl><dt>${t('x_pagecount')}</dt><dd>${n}</dd><dt>${t('x_spine')}</dt><dd>${fc.spine.toFixed(3)} in</dd><dt>${t('x_cover_size')}</dt><dd>${fc.w.toFixed(3)} × ${fc.h.toFixed(3)} in</dd></dl><p class="muted">${t('x_note')}</p><p class="muted">${t('x_note2')}</p></div>`;
  $$('[data-x]', el).forEach(b => b.onclick = () => withBusy(b, () => doExport(b.dataset.x)));
}
async function doExport(kind) {
  const name = safeName(B.title);
  if (kind === 'json') return download(new Blob([JSON.stringify(B)], { type: 'application/json' }), name + '.ebda3.json');
  if (kind === 'png') { const c = selIdx === -1 ? await renderCover(B, { dpi: 300 }) : await renderPage(B, pageAt(), { dpi: 300, index: selIdx }); return download(await canvasBlob(c), `${name}-${selIdx === -1 ? 'cover' : selIdx + 1}.png`); }
  if (kind === 'cover') { const c = await renderCover(B, { dpi: 300, bleed: true }); const d = dims(B, 300, true); return download(buildPdf([{ bytes: await canvasJpeg(c, 0.93), w: c.width, h: c.height, wIn: d.w / 300, hIn: d.h / 300 }], B.title), name + '-cover.pdf'); }
  if (kind === 'full') { const c = await renderFullCover(B, { dpi: 300 }), s = fullCoverSize(B); return download(buildPdf([{ bytes: await canvasJpeg(c, 0.93), w: c.width, h: c.height, wIn: s.w, hIn: s.h }], B.title), name + '-full-cover.pdf'); }
  const print = kind === 'print', dpi = print ? 300 : 150, bleed = print && B.bleed, pages = [];
  for (let i = 0; i < B.pages.length; i++) { const c = await renderPage(B, B.pages[i], { dpi, bleed, index: i }); pages.push({ bytes: await canvasJpeg(c, print ? 0.93 : 0.85), w: c.width, h: c.height, wIn: c.width / dpi, hIn: c.height / dpi }); }
  if (!print) { const c = await renderCover(B, { dpi }); pages.unshift({ bytes: await canvasJpeg(c, 0.85), w: c.width, h: c.height, wIn: c.width / dpi, hIn: c.height / dpi }); }
  download(buildPdf(pages, B.title), name + (print ? '-print' : '') + '.pdf');
}

// ---------- router ----------
async function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?'), q = new URLSearchParams(qs || ''), seg = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  try {
    if (!seg.length) home(); else if (seg[0] === 'create') createPage(q); else if (seg[0] === 'tools') seg[1] ? toolPage(seg[1]) : toolsHome();
    else if (seg[0] === 'library') await library(); else if (seg[0] === 'book') await editor(seg[1]); else if (seg[0] === 'faq') faq(); else if (seg[0] === 'settings') settingsPage(); else home();
  } catch (e) { console.error(e); toast(String(e.message || e), 'err'); }
}
apply();
window.addEventListener('hashchange', route);
route();
window.__ebda3 = { projects, AI, Q };
