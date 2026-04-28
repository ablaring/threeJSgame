import { Buffer } from 'buffer';
import { ShopItem } from './ShopCatalog';
import { WalletManager } from './WalletManager';

const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';
const DEFAULT_CLUSTER = 'devnet';

export interface SolanaPaymentReceipt {
  itemId: string;
  signature: string;
  buyer: string;
  recipient: string;
  priceSol: number;
  lamports: number;
  cluster: string;
  explorerUrl: string;
}

export class SolanaPaymentService {
  private readonly treasuryAddress = ((import.meta.env.VITE_SHOP_TREASURY_ADDRESS as string | undefined) ?? '').trim();
  private readonly rpcUrl = ((import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ?? DEFAULT_RPC_URL).trim();
  private readonly cluster = ((import.meta.env.VITE_SOLANA_CLUSTER as string | undefined) ?? DEFAULT_CLUSTER).trim();

  constructor(private wallet: WalletManager) {}

  isEnabled(): boolean {
    return this.treasuryAddress.length > 0;
  }

  getNetworkLabel(): string {
    return this.cluster || 'custom';
  }

  async buyShopItem(item: ShopItem): Promise<SolanaPaymentReceipt> {
    if (!this.isEnabled()) {
      throw new Error('Solana payments are not configured');
    }

    const provider = this.wallet.getProvider();
    if (!provider) {
      throw new Error('Phantom is not available');
    }
    if (!provider.signAndSendTransaction) {
      throw new Error('This Phantom provider cannot sign Solana transactions');
    }

    const buyerAddress = this.wallet.publicKey ?? provider.publicKey?.toBase58();
    if (!buyerAddress) {
      throw new Error('Wallet is not connected');
    }

    ensureBuffer();
    const {
      Connection,
      LAMPORTS_PER_SOL,
      PublicKey,
      SystemProgram,
      Transaction,
    } = await import('@solana/web3.js');

    const buyer = new PublicKey(buyerAddress);
    const recipient = new PublicKey(this.treasuryAddress);
    const lamports = solToLamports(item.priceSol, LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      throw new Error(`Invalid price for ${item.name}`);
    }

    const connection = new Connection(this.rpcUrl, 'confirmed');
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction({
      feePayer: buyer,
      recentBlockhash: latestBlockhash.blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: recipient,
        lamports,
      })
    );

    const { signature } = await provider.signAndSendTransaction(transaction);
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error('Solana transaction failed');
    }

    return {
      itemId: item.id,
      signature,
      buyer: buyer.toBase58(),
      recipient: recipient.toBase58(),
      priceSol: item.priceSol,
      lamports,
      cluster: this.cluster,
      explorerUrl: this.getExplorerUrl(signature),
    };
  }

  private getExplorerUrl(signature: string): string {
    const suffix = this.cluster && this.cluster !== 'mainnet-beta'
      ? `?cluster=${encodeURIComponent(this.cluster)}`
      : '';
    return `https://explorer.solana.com/tx/${signature}${suffix}`;
  }
}

function ensureBuffer() {
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }
}

function solToLamports(sol: number, lamportsPerSol: number): number {
  return Math.round(sol * lamportsPerSol);
}
