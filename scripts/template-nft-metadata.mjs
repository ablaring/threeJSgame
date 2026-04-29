/**
 * Replace `__BASE_URL__` placeholders in public/nft/*.json with the value of
 * NFT_METADATA_BASE_URL. Run once after pushing the folder to GitHub:
 *
 *   NFT_METADATA_BASE_URL="https://raw.githubusercontent.com/USER/REPO/main/public/nft" \
 *     node scripts/template-nft-metadata.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NFT_DIR = resolve(__dirname, '..', 'public', 'nft');

const baseUrl = process.env.NFT_METADATA_BASE_URL;
if (!baseUrl) {
  console.error('ERROR: NFT_METADATA_BASE_URL is required');
  console.error('  e.g. https://raw.githubusercontent.com/<USER>/<REPO>/main/public/nft');
  process.exit(1);
}
const trimmed = baseUrl.replace(/\/+$/, '');

const files = readdirSync(NFT_DIR).filter((f) => f.endsWith('.json'));
let changed = 0;
for (const file of files) {
  const path = resolve(NFT_DIR, file);
  const before = readFileSync(path, 'utf8');
  const after = before.replaceAll('__BASE_URL__', trimmed);
  if (before !== after) {
    writeFileSync(path, after);
    console.log(`✓ ${file}`);
    changed++;
  } else {
    console.log(`· ${file} (no placeholders found)`);
  }
}
console.log(`\nDone. ${changed} file(s) updated. Base URL: ${trimmed}`);
