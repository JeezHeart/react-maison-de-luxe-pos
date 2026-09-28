// Renders every ```mermaid``` block in ARCHITECTURE.md to an SVG image via the
// public mermaid.ink service, saving to docs/img/architecture-N.svg.
//
// Run from the repo root:  node scripts/render-diagrams.mjs
//
// The SVGs make the diagrams visible in any Markdown viewer (not only GitHub);
// ARCHITECTURE.md embeds them as <img> and keeps the Mermaid source in
// <details> blocks. After editing a diagram, re-run this script and recommit
// the changed SVG. No secrets are involved — diagrams are static text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = path.join(root, 'ARCHITECTURE.md');
const outDir = path.join(root, 'docs', 'img');

const md = fs.readFileSync(mdPath, 'utf8');
const re = /```mermaid\n([\s\S]*?)```/g;
const blocks = [];
let m;
while ((m = re.exec(md)) !== null) blocks.push(m[1].trim());

if (blocks.length === 0) {
  console.error('No mermaid blocks found in ARCHITECTURE.md');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

let failed = 0;
for (let i = 0; i < blocks.length; i++) {
  const state = { code: blocks[i], mermaid: { theme: 'default' }, autoFit: true };
  const url = 'https://mermaid.ink/svg/' + Buffer.from(JSON.stringify(state)).toString('base64url');
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) {
    console.error(`FAIL diagram ${i + 1}: mermaid.ink ${res.status} — ${(await res.text()).slice(0, 200)}`);
    failed += 1;
    continue;
  }
  const svg = await res.text();
  fs.writeFileSync(path.join(outDir, `architecture-${i + 1}.svg`), svg);
  console.log(`OK docs/img/architecture-${i + 1}.svg (${svg.length} bytes) — ${JSON.stringify(blocks[i].split('\n')[0])}`);
}

process.exitCode = failed > 0 ? 1 : 0;