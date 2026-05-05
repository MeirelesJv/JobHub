#!/usr/bin/env node
/**
 * Gera ícones PNG placeholder (fundo indigo #4F46E5) sem dependências externas.
 * Executar: node scripts/generate-icons.js
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────

let _crcTable;
function crc32(buf) {
  if (!_crcTable) {
    _crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      _crcTable[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(size, r, g, b) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Raw pixel rows: filter_byte(0) + RGB per pixel
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0;
  for (let x = 0; x < size; x++) {
    row[1 + x * 3]     = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw  = Buffer.concat(Array(size).fill(row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Generate ─────────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// Indigo #4F46E5 → rgb(79, 70, 229)
for (const size of [16, 48, 128]) {
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, makePNG(size, 79, 70, 229));
  console.log(`✓ ${file}`);
}

console.log('\nÍcones gerados em public/icons/');
