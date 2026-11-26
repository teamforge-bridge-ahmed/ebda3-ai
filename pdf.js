// Minimal PDF writer: one JPEG per page, exact page size. No dependencies.
const enc = new TextEncoder();
export async function canvasJpeg(canvas, q = 0.92) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  return new Uint8Array(await blob.arrayBuffer());
}
export function buildPdf(pages, title = '') {
  const parts = []; let len = 0; const offs = [];
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); add(body); add('\nendobj\n'); };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length, kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${kids}] >>`);
  const hex = Array.from(title).map(ch => ch.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  obj(3, `<< /Title <FEFF${hex}> /Producer (EBDA3 AI) >>`);
  pages.forEach((p, i) => {
    const pn = 4 + i * 3, cn = pn + 1, im = pn + 2, wp = (p.wIn * 72).toFixed(2), hp = (p.hIn * 72).toFixed(2);
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wp} ${hp}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`);
    const content = `q ${wp} 0 0 ${hp} 0 0 cm /Im0 Do Q`;
    obj(cn, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offs[im] = len; add(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); add(p.bytes); add('\nendstream\nendobj\n');
  });
  const total = 4 + n * 3, xref = len;
  add(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  add(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
