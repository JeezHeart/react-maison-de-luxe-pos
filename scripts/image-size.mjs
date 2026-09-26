// Report image dimensions and basic properties without any dependency.
// Reads header bytes only: PNG (IHDR), JPEG (SOFn), GIF, WebP.
//
// Useful for spotting assets that are far larger than the size they are
// displayed at — the two logos in this project were 1536x1024 while the app
// never renders them above 64 CSS px, which cost 4 MB of downloads.
//
//   npm run assets:sizes                       # the whole images folder
//   node scripts/image-size.mjs path/to.png …  # specific files
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DEFAULT_DIR = 'public/assets/images';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

function png(buf) {
  // 8-byte signature, then an IHDR chunk whose data starts at byte 16.
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], color: buf[25] };
}

function jpeg(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15, excluding the markers that share that numeric range.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function webp(buf) {
  const fmt = buf.toString('ascii', 12, 16);
  if (fmt === 'VP8X') {
    return {
      w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  if (fmt === 'VP8 ') {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fmt === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function describe(file) {
  const buf = readFileSync(file);
  let info = null;
  let kind = 'unknown';
  if (buf.length > 26 && buf.readUInt32BE(0) === 0x89504e47) {
    info = png(buf);
    kind = 'PNG';
  } else if (buf[0] === 0xff && buf[1] === 0xd8) {
    info = jpeg(buf);
    kind = 'JPEG';
  } else if (buf.toString('ascii', 0, 3) === 'GIF') {
    kind = 'GIF';
  } else if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    info = webp(buf);
    kind = 'WebP';
  } else if (buf.toString('ascii', 0, 5).trimStart().startsWith('<')) {
    kind = 'SVG';
  }

  const kb = buf.length / 1024;
  if (info) {
    const bytesPerPx = buf.length / (info.w * info.h);
    return {
      file,
      kind,
      w: info.w,
      h: info.h,
      kb,
      bytesPerPx,
      extra: info.depth ? `depth=${info.depth} colourType=${info.color}` : '',
    };
  }
  return { file, kind, kb };
}

let files = process.argv.slice(2);
// No arguments (or a glob that the shell did not expand) means scan the folder,
// so the script works the same on Windows as on macOS/Linux.
if (files.length === 0 || files.some((f) => f.includes('*'))) {
  files = readdirSync(DEFAULT_DIR)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .map((f) => join(DEFAULT_DIR, f));
}

const rows = files
  .filter((f) => statSync(f).isFile())
  .map(describe)
  .sort((a, b) => b.kb - a.kb);

const nameWidth = Math.max(...rows.map((r) => r.file.length), 10);

console.log(
  `${'file'.padEnd(nameWidth)}  ${'size'.padStart(10)}  ${'KB'.padStart(9)}  ${'B/px'.padStart(6)}  detail`
);
for (const r of rows) {
  const size = r.w ? `${r.w}x${r.h}` : '—';
  const perPx = r.bytesPerPx ? r.bytesPerPx.toFixed(2) : '—';
  const detail = [r.kind, r.extra].filter(Boolean).join('  ');
  console.log(
    `${r.file.padEnd(nameWidth)}  ${size.padStart(10)}  ${r.kb.toFixed(1).padStart(9)}  ${perPx.padStart(6)}  ${detail}`
  );
}

const totalKB = rows.reduce((s, r) => s + r.kb, 0);
console.log(`\n${rows.length} files, ${(totalKB / 1024).toFixed(2)} MB total`);
