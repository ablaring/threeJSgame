/**
 * Authoritative weapon catalog (server side). Mirrors the client catalog —
 * keep them in sync. The server is the source of truth for prices: even if
 * the client lies in the request, the server uses these numbers.
 */

export interface CatalogEntry {
  id: string;            // matches the client ShopItem id
  name: string;          // shown on-chain in the NFT name
  metadataFile: string;  // filename under NFT_METADATA_BASE_URL
  priceLamports: number; // server-authoritative price
}

const SOL = 1_000_000_000;

export const CATALOG: Record<string, CatalogEntry> = {
  'ak47': {
    id: 'ak47',
    name: 'AK47',
    metadataFile: 'ak47.json',
    priceLamports: Math.round(0.05 * SOL),
  },
  'rocket-launcher': {
    id: 'rocket-launcher',
    name: 'Rocket Launcher',
    metadataFile: 'rocket-launcher.json',
    priceLamports: Math.round(0.15 * SOL),
  },
};

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG[id];
}
