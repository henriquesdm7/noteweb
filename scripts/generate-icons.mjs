// Gera os ícones PNG da extensão (um post-it com canto dobrado) sem dependências externas.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const OUT_DIR = new URL('../public/icons/', import.meta.url);
const SAMPLES = 4; // supersampling para antialiasing

const BODY = [255, 216, 77];
const FOLD = [224, 170, 0];
const LINE = [122, 92, 0];

function shade(u, v) {
  // Coordenadas normalizadas 0..1. Retorna [r, g, b, a] ou null.
  const x0 = 0.1, y0 = 0.1, x1 = 0.9, y1 = 0.9, r = 0.12, fold = 0.26;
  if (u < x0 || u > x1 || v < y0 || v > y1) return null;
  // Cantos arredondados (exceto o canto dobrado, inferior direito).
  const corners = [[x0 + r, y0 + r], [x1 - r, y0 + r], [x0 + r, y1 - r]];
  for (const [cx, cy] of corners) {
    const inCornerBox = (u < x0 + r || u > x1 - r) && (v < y0 + r || v > y1 - r);
    if (inCornerBox && Math.abs(u - cx) <= r && Math.abs(v - cy) <= r && Math.hypot(u - cx, v - cy) > r) return null;
  }
  const diag = u + v - (x1 + y1 - fold);
  if (diag > 0) return null; // recorte do canto
  if (u >= x1 - fold && v >= y1 - fold) return [...FOLD, 255]; // aba dobrada
  const lines = [[0.36, 0.72], [0.5, 0.66], [0.64, 0.5]];
  for (const [ly, lx] of lines) {
    if (Math.abs(v - ly) < 0.035 && u > 0.24 && u < lx) return [...LINE, 255];
  }
  return [...BODY, 255];
}

function render(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filtro "None"
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = shade((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size);
          if (!c) continue;
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const i = row + 1 + x * 4;
      const n = SAMPLES * SAMPLES;
      raw[i] = a ? Math.round(r / a) : 0;
      raw[i + 1] = a ? Math.round(g / a) : 0;
      raw[i + 2] = a ? Math.round(b / a) : 0;
      raw[i + 3] = Math.round(a / n);
    }
  }
  return raw;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), png(size));
  console.log(`public/icons/icon-${size}.png`);
}
