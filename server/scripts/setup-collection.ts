/**
 * One-shot script to provision the Solana side of the weapon shop.
 *
 *   npm run setup:collection
 *
 * Modes (decided automatically from your .env):
 *
 * 1. MINT_AUTHORITY_SECRET is empty → generates a new keypair, prints the
 *    pubkey + base58 secret, and asks you to (a) save it in .env and (b) fund
 *    the address with SOL (~0.05 SOL on mainnet).
 *
 * 2. MINT_AUTHORITY_SECRET is set but balance < 0.02 SOL → prints the
 *    funding instructions and exits.
 *
 * 3. Authority is funded and COLLECTION_MINT is empty → mints the collection
 *    NFT on the configured cluster, prints the resulting mint pubkey for you
 *    to paste into .env.
 *
 * 4. COLLECTION_MINT is already set → refuses to do anything (would burn SOL
 *    for nothing).
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import bs58 from 'bs58';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
} from '@metaplex-foundation/umi';

const RPC_URL = (process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim();
const CLUSTER = (process.env.SOLANA_CLUSTER ?? 'mainnet-beta').trim();
const SECRET_ENV = (process.env.MINT_AUTHORITY_SECRET ?? '').trim();
const COLLECTION_ENV = (process.env.COLLECTION_MINT ?? '').trim();
const METADATA_BASE = (process.env.NFT_METADATA_BASE_URL ?? '').trim();
const MIN_BALANCE_LAMPORTS = 0.02 * LAMPORTS_PER_SOL;

function divider() {
  console.log('━'.repeat(60));
}

async function main() {
  divider();
  console.log(`Solana setup — cluster=${CLUSTER}  rpc=${RPC_URL}`);
  divider();

  // --- Step 1: generate authority if missing ---------------------------------
  if (!SECRET_ENV) {
    const keypair = Keypair.generate();
    const secret = bs58.encode(keypair.secretKey);

    // Also dump to a local file as a safety net, in case the user forgets to
    // copy it into .env. NOT committed (.gitignore covers it).
    const dumpPath = `${process.cwd()}/mint-authority.json`;
    writeFileSync(dumpPath, JSON.stringify({
      cluster: CLUSTER,
      pubkey: keypair.publicKey.toBase58(),
      secret,
    }, null, 2));

    console.log('\n✓ Generated a new mint authority keypair.\n');
    console.log(`  Pubkey:  ${keypair.publicKey.toBase58()}`);
    console.log(`  Secret:  ${secret}`);
    console.log(`  Saved a copy to:  ${dumpPath}\n`);
    console.log('Next:');
    console.log(`  1. Add to server/.env:`);
    console.log(`       MINT_AUTHORITY_SECRET=${secret}`);
    console.log(`  2. Send ~0.05 SOL on ${CLUSTER} to the pubkey above (mint setup + headroom).`);
    console.log(`  3. Run \`npm run setup:collection\` again to create the Collection NFT.`);
    console.log(`  4. Delete ${dumpPath} once the secret is in .env.\n`);
    return;
  }

  // --- Step 2: balance check -------------------------------------------------
  const secretBytes = bs58.decode(SECRET_ENV);
  if (secretBytes.length !== 64) {
    throw new Error(`MINT_AUTHORITY_SECRET must decode to 64 bytes (got ${secretBytes.length})`);
  }
  const authority = Keypair.fromSecretKey(secretBytes);
  const conn = new Connection(RPC_URL, 'confirmed');
  const balance = await conn.getBalance(authority.publicKey, 'confirmed');

  console.log(`Authority pubkey: ${authority.publicKey.toBase58()}`);
  console.log(`Balance:          ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < MIN_BALANCE_LAMPORTS) {
    console.log(`\n✗ Balance is below ${MIN_BALANCE_LAMPORTS / LAMPORTS_PER_SOL} SOL.`);
    console.log(`  Send some SOL to ${authority.publicKey.toBase58()} on ${CLUSTER},`);
    console.log(`  then re-run \`npm run setup:collection\`.\n`);
    return;
  }

  // --- Step 3: short-circuit if collection already exists --------------------
  if (COLLECTION_ENV) {
    console.log(`\n✓ Collection already configured: ${COLLECTION_ENV}`);
    console.log(`  Nothing to do. (Delete COLLECTION_MINT from .env if you intentionally`);
    console.log(`  want to mint a new collection — but the old one will be orphaned.)\n`);
    return;
  }

  // --- Step 4: create the Collection NFT -------------------------------------
  console.log('\nCreating the Arsenal collection NFT...\n');

  if (!METADATA_BASE) {
    throw new Error('NFT_METADATA_BASE_URL is required to point the collection at a metadata JSON');
  }

  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  // Convert the web3 Keypair into a Umi signer.
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(authority.secretKey);
  umi.use(keypairIdentity(umiKeypair));

  const collectionMint = generateSigner(umi);
  const collectionMetadataUri = `${METADATA_BASE.replace(/\/+$/, '')}/collection.json`;

  console.log(`  Mint pubkey (will be):  ${collectionMint.publicKey}`);
  console.log(`  Metadata URI:           ${collectionMetadataUri}\n`);

  await createNft(umi, {
    mint: collectionMint,
    name: 'Arsenal',
    symbol: 'ARSENAL',
    uri: collectionMetadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
    tokenStandard: TokenStandard.NonFungible,
    creators: [
      {
        address: publicKey(authority.publicKey.toBase58()),
        verified: true,
        share: 100,
      },
    ],
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  divider();
  console.log(`\n✓ Collection NFT minted on ${CLUSTER}!\n`);
  console.log(`  Add to server/.env:`);
  console.log(`    COLLECTION_MINT=${collectionMint.publicKey}\n`);
  console.log(`  And add to project root .env (or .env.local) for the Vite client:`);
  console.log(`    VITE_COLLECTION_MINT=${collectionMint.publicKey}\n`);
  divider();
}

main().catch((err) => {
  console.error('\n✗ Setup failed:', err);
  process.exit(1);
});
