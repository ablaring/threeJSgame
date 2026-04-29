import type { IncomingMessage, ServerResponse } from 'node:http';
import { PublicKey } from '@solana/web3.js';
import { getCatalogEntry } from '../solana/catalog';
import { buildMintTransaction } from '../solana/buildMintTransaction';
import { isSolanaMintConfigured, solanaConfig } from '../solana/env';

/**
 * Returns true if the request was handled. The vanilla http handler in
 * index.ts delegates to this for /shop/* paths.
 */
export async function handleShopRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url) return false;

  // CORS — Vite is on a different port, browsers will preflight POST/JSON.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.url === '/shop/config' && req.method === 'GET') {
    sendJson(res, 200, {
      enabled: isSolanaMintConfigured(),
      cluster: solanaConfig.cluster,
      treasury: solanaConfig.treasury || null,
      collectionMint: solanaConfig.collectionMint || null,
      metadataBaseUrl: solanaConfig.metadataBaseUrl || null,
    });
    return true;
  }

  if (req.url === '/shop/mint' && req.method === 'POST') {
    if (!isSolanaMintConfigured()) {
      sendJson(res, 503, { error: 'Solana mint endpoint is not configured. Run setup:collection.' });
      return true;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return true;
    }
    const { itemId, buyer } = (body ?? {}) as { itemId?: string; buyer?: string };

    if (typeof itemId !== 'string' || typeof buyer !== 'string') {
      sendJson(res, 400, { error: 'Expected { itemId: string, buyer: string }' });
      return true;
    }

    const entry = getCatalogEntry(itemId);
    if (!entry) {
      sendJson(res, 404, { error: `Unknown item: ${itemId}` });
      return true;
    }

    let buyerPk: PublicKey;
    try {
      buyerPk = new PublicKey(buyer);
    } catch {
      sendJson(res, 400, { error: 'Invalid buyer pubkey' });
      return true;
    }

    try {
      const built = await buildMintTransaction(entry, buyerPk);
      sendJson(res, 200, {
        transaction: built.transactionBase64,
        mint: built.mintPubkey,
        metadataUri: built.metadataUri,
        priceLamports: entry.priceLamports,
      });
    } catch (err) {
      console.error('[/shop/mint] failed:', err);
      sendJson(res, 500, { error: (err as Error).message ?? 'Mint failed' });
    }
    return true;
  }

  return false;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 64 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
