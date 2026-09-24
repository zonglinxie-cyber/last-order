// Optional asset build. Requires cwebp on PATH; never overwrites source artwork.
import { readdirSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'public/assets/aurora');
const output = resolve(root, 'public/assets/optimized');
mkdirSync(output, { recursive: true });
const files = readdirSync(source).filter(name => /^customer-.*-consultation\.png$/.test(name) || name === 'product-trio.png');
const records = [];
for (const name of files) {
  const stem = name.replace(/\.png$/, '');
  const full = join(output, `${stem}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', '88', '-m', '6', join(source, name), '-o', full]);
  const record = { source: name, originalBytes: statSync(join(source, name)).size, webpBytes: statSync(full).size };
  if (name.startsWith('customer-')) {
    const thumb = join(output, `${stem}-thumb.webp`);
    execFileSync('cwebp', ['-quiet', '-q', '84', '-resize', '148', '0', join(source, name), '-o', thumb]);
    record.thumbnailBytes = statSync(thumb).size;
  }
  records.push(record);
}
writeFileSync(join(output, 'manifest.json'), JSON.stringify({ format: 'WebP', quality: 88, thumbnailWidth: 148, records }, null, 2) + '\n');
console.log(JSON.stringify(records, null, 2));
