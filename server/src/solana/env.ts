import 'dotenv/config';
import bs58 from 'bs58';
import { Keypair, PublicKey } from '@solana/web3.js';

function required(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`${name} is required (see server/.env.example)`);
  return v;
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export const solanaConfig = {
  rpcUrl: optional('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
  cluster: optional('SOLANA_CLUSTER', 'mainnet-beta'),
  treasury: optional('SHOP_TREASURY_ADDRESS'),
  mintAuthoritySecret: optional('MINT_AUTHORITY_SECRET'),
  collectionMint: optional('COLLECTION_MINT'),
  metadataBaseUrl: optional('NFT_METADATA_BASE_URL'),
};

/** Returns true if the server has everything required to run the mint endpoint. */
export function isSolanaMintConfigured(): boolean {
  return Boolean(
    solanaConfig.treasury &&
    solanaConfig.mintAuthoritySecret &&
    solanaConfig.collectionMint &&
    solanaConfig.metadataBaseUrl
  );
}

export function loadMintAuthority(): Keypair {
  const secret = required('MINT_AUTHORITY_SECRET');
  const bytes = bs58.decode(secret);
  if (bytes.length !== 64) {
    throw new Error(`MINT_AUTHORITY_SECRET must decode to 64 bytes (got ${bytes.length})`);
  }
  return Keypair.fromSecretKey(bytes);
}

export function getCollectionMint(): PublicKey {
  return new PublicKey(required('COLLECTION_MINT'));
}

export function getTreasury(): PublicKey {
  return new PublicKey(required('SHOP_TREASURY_ADDRESS'));
}
