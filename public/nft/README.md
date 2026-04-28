# NFT assets

Static assets for the in-game weapon NFTs (Metaplex Token Metadata standard).

## Files

- `ak47.png` / `rocket-launcher.png` / `pistol.png` — 1024×1024 transparent renders of the weapons
- `ak47.json` / `rocket-launcher.json` — off-chain metadata referenced by each NFT's URI

The pistol is the free starter weapon, no NFT exists for it. Its render is kept here for parity.

## Workflow

1. Regenerate the PNGs (after a model change) with the dev server running:

   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2
   node scripts/render-nft-images.mjs
   ```

2. Push this folder to GitHub.

3. Run the templating script ONCE to fill the `__BASE_URL__` placeholders in
   the JSON files with your raw GitHub URL:

   ```bash
   NFT_METADATA_BASE_URL="https://raw.githubusercontent.com/<USER>/<REPO>/main/public/nft" \
     node scripts/template-nft-metadata.mjs
   ```

4. Commit and push the templated JSON files.

5. Set `NFT_METADATA_BASE_URL` in the server `.env` (same value) so the mint
   endpoint sets the correct on-chain `uri` field.
