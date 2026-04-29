import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
  verifyCollectionV1,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createNoopSigner,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
  signTransaction,
  transactionBuilder,
} from '@metaplex-foundation/umi';

import {
  getCollectionMint,
  getTreasury,
  loadMintAuthority,
  solanaConfig,
} from './env';
import { CatalogEntry } from './catalog';

export interface BuiltMintTx {
  /** Base64-encoded serialized transaction, partially signed by mint+authority. */
  transactionBase64: string;
  /** The mint pubkey of the NFT being created (so the client can verify after). */
  mintPubkey: string;
  /** Metadata URI baked into the NFT, for client display. */
  metadataUri: string;
}

/**
 * Build an unsigned-by-buyer mint transaction:
 *
 *   ix0: SystemProgram.transfer  (buyer → treasury, server-priced)
 *   ix1..N: createNft + verifyCollectionV1
 *
 * The tx is partially signed by:
 *   - the new mint keypair (so the mint account can be created)
 *   - the mint authority (to authorize verifyCollectionV1)
 *
 * The buyer's Phantom adds the final signature as fee payer + transfer source.
 */
export async function buildMintTransaction(
  entry: CatalogEntry,
  buyer: PublicKey,
): Promise<BuiltMintTx> {
  const authority = loadMintAuthority();
  const collectionMint = getCollectionMint();
  const treasury = getTreasury();

  const umi = createUmi(solanaConfig.rpcUrl).use(mplTokenMetadata());
  const umiKp = umi.eddsa.createKeypairFromSecretKey(authority.secretKey);
  umi.use(keypairIdentity(umiKp));

  const buyerPk = publicKey(buyer.toBase58());
  const buyerSigner = createNoopSigner(buyerPk);
  const mint = generateSigner(umi);
  const metadataUri = `${(solanaConfig.metadataBaseUrl ?? '').replace(/\/+$/, '')}/${entry.metadataFile}`;

  // 1) The Solana SystemProgram.transfer ix (raw web3.js). Wrap it so it can
  //    sit in front of the Umi instructions in a single tx.
  const transferIx = SystemProgram.transfer({
    fromPubkey: buyer,
    toPubkey: treasury,
    lamports: entry.priceLamports,
  });
  const wrappedTransfer = web3IxToUmi(transferIx, buyerSigner);

  // 2) createNft attaches it to our collection (unverified) and points at the
  //    metadata JSON. Buyer becomes the token holder.
  const createIx = createNft(umi, {
    mint,
    name: entry.name,
    symbol: 'ARSENAL',
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    tokenOwner: buyerPk,
    collection: { key: publicKey(collectionMint.toBase58()), verified: false },
    creators: [
      { address: publicKey(authority.publicKey.toBase58()), verified: true, share: 100 },
    ],
  });

  // 3) verifyCollectionV1 promotes the NFT into the verified collection. Only
  //    callable by the collection's update authority — that's our mint authority.
  const metadataPda = findMetadataPda(umi, { mint: mint.publicKey });
  const verifyIx = verifyCollectionV1(umi, {
    metadata: metadataPda,
    collectionMint: publicKey(collectionMint.toBase58()),
    authority: umi.identity, // collection update authority signs
  });

  // Build the combined transaction with the buyer as fee payer (noop signer
  // — the slot is reserved, the actual signature comes from Phantom).
  const builder = transactionBuilder()
    .add(wrappedTransfer)
    .add(createIx)
    .add(verifyIx)
    .setFeePayer(buyerSigner);

  const txn = await builder.buildWithLatestBlockhash(umi);

  // Sign with the two server-side signers; the buyer slot stays empty.
  const signed = await signTransaction(txn, [umi.identity, mint]);

  const bytes = umi.transactions.serialize(signed);
  const transactionBase64 = Buffer.from(bytes).toString('base64');

  return {
    transactionBase64,
    mintPubkey: mint.publicKey,
    metadataUri,
  };
}

/** Convert a web3.js TransactionInstruction into a Umi WrappedInstruction. */
function web3IxToUmi(
  ix: TransactionInstruction,
  signer: ReturnType<typeof createNoopSigner>,
) {
  return {
    instruction: {
      programId: publicKey(ix.programId.toBase58()),
      keys: ix.keys.map((k) => ({
        pubkey: publicKey(k.pubkey.toBase58()),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: new Uint8Array(ix.data),
    },
    signers: [signer],
    bytesCreatedOnChain: 0,
  };
}
