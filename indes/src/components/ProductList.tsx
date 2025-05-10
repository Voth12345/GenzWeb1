import React, { useMemo } from 'react';
import { GameProduct } from '../types';
import { Check, ShoppingCart } from 'lucide-react';

interface Props {
  products: GameProduct[];
  selectedProduct: GameProduct | null;
  onSelect: (product: GameProduct) => void;
  game: 'mlbb' | 'freefire';
}

export function ProductList({ products, selectedProduct, onSelect, game }: Props) {
  const isReseller = localStorage.getItem('jackstore_reseller_auth') === 'true';

  const groupedProducts = useMemo(() => {
    const groups = products.reduce((acc, product) => {
      acc[product.type] = [...(acc[product.type] || []), product];
      return acc;
    }, {} as Record<string, GameProduct[]>);

    if (groups.diamonds) {
      groups.diamonds.sort((a, b) => (a.diamonds || 0) - (b.diamonds || 0));
    }
    return groups;
  }, [products]);

  const renderProductCard = (product: GameProduct) => (
    <div
      key={product.id}
      onClick={() => onSelect(product)}
      className={`relative p-2 rounded-lg cursor-pointer transition-colors ${
        selectedProduct?.id === product.id
          ? 'border-2 border-pink-400 bg-pink-50/50'
          : 'border border-white/10 hover:border-pink-400/30 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-10 h-10 rounded-lg object-cover"
            loading="lazy"
          />
          {selectedProduct?.id === product.id && (
            <Check className="absolute -top-1 -right-1 w-3 h-3 bg-pink-400 text-pink-900 rounded-full p-0.5" />
          )}
        </div>
        <h3 className="text-xs text-white text-center">{product.name}</h3>
        {product.diamonds && <p className="text-[10px] text-pink-200">{product.diamonds} Diamonds</p>}
        <p className="text-xs font-bold text-[#FFD700]">${product.price.toFixed(2)}</p>
        {isReseller && product.resellerPrice && (
          <p className="text-[10px] text-pink-400">Reseller: ${product.resellerPrice.toFixed(2)}</p>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
        <span className="text-[10px] text-white flex items-center gap-0.5">
          <ShoppingCart className="w-2.5 h-2.5" /> Select
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {['diamonds', 'subscription', 'special'].map(
        (type) =>
          groupedProducts[type] && (
            <div key={type}>
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-1">
                {type === 'diamonds' ? '💎 Diamonds' : type === 'subscription' ? '🎮 Subscriptions' : '⭐ Special'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {groupedProducts[type].map(renderProductCard)}
              </div>
            </div>
          )
      )}
    </div>
  );
      }
