export interface ShopItem {
  id: string;
  name: string;
  description: string;
  priceSol: number; // mock price for now (Phase 3 wires real Solana tx)
  icon: string;     // emoji or short string used in the card
  accent: string;   // CSS color for the price chip
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'ak47',
    name: 'AK47',
    description: 'Auto-rifle · 25 dmg/shot · 600 rpm',
    priceSol: 0.05,
    icon: '🔫',
    accent: '#ffaa44',
  },
  {
    id: 'rocket-launcher',
    name: 'Rocket Launcher',
    description: 'Splash · up to 90 dmg · 6m radius',
    priceSol: 0.15,
    icon: '🚀',
    accent: '#ff6644',
  },
];

export function getItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((it) => it.id === id);
}
