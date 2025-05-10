import React, { useMemo } from 'react';
import { GameProduct } from '../types';
import { Check, ShoppingCart, Star, Sparkles, Flame, Crown } from 'lucide-react';

interface Props {
  products: GameProduct[];
  selectedProduct: GameProduct | null;
  onSelect: (product: GameProduct) => void;
  game: string;
}

export function ProductList({ products, selectedProduct, onSelect, game }: Props) {
  const isReseller = localStorage.getItem('jackstore_reseller_auth') === 'true';

  const groupedProducts = useMemo(() => {
    const groups = products.reduce((acc, product) => {
      const type = product.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(product);
      return acc;
    }, {} as Record<string, GameProduct[]>);

    if (groups.diamonds) {
      groups.diamonds.sort((a, b) => (a.diamonds || 0) - (b.diamonds || 0));
    }

    return groups;
  }, [products]);

  const getTagIcon = (tagname: string) => {
    const lowercaseTag = tagname.toLowerCase();
    if (lowercaseTag.includes('hot')) return <Flame className="w-3 h-3" />;
    if (lowercaseTag.includes('best')) return <Star className="w-3 h-3" />;
    if (lowercaseTag.includes('new')) return <Sparkles className="w-3 h-3" />;
    if (lowercaseTag.includes('premium')) return <Crown className="w-3 h-3" />;
    return null;
  };

  const renderProductCard = (product: GameProduct) => (
    <div
      key={product.id}
      onClick={() => onSelect(product)}
      className={`relative group overflow-visible rounded-lg transition-all duration-300 cursor-pointer border border-gray-500 bg-[#FFFFFF] ${
        selectedProduct?.id === product.id
          ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-50/10 to-yellow-100/5 shadow-[inset_0_0_8px_4px_rgba(234,179,8,0.5)]'
          : 'hover:bg-white/10 shadow-md hover:shadow-lg shadow-gray-500/10 hover:shadow-gray-500/20'
      }`}
    >
      {product.tagname && (
        <div className="absolute -top-2 left-0 right-0 z-20 flex justify-center">
          <div className="bg-gradient-to-r from-[#e10a0a] to-[#e10a0a] text-white px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap text-xs font-bold shadow-lg shadow-[#e10a0a]/30">
            {getTagIcon(product.tagname)}
            <span>{product.tagname.toUpperCase()}</span>
          </div>
        </div>
      )}

      <div className={`p-2 flex flex-row items-center gap-2 ${product.tagname ? 'pt-4' : ''}`}>
        <div className="relative flex-shrink-0">
          <img
            src={product.image || 'https://via.placeholder.com/40'}
            alt={product.name}
            className="w-8 h-8 rounded-md object-cover shadow-sm"
            loading="lazy"
          />
          {selectedProduct?.id === product.id && (
            <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full p-0.5 z-20 shadow-md">
              <Check className="w-3 h-3" />
            </div>
          )}
        </div>
        
        <div className="text-left space-y-0.5 flex-1">
          <h3 className="font-medium text-xs text-black leading-tight truncate">{product.name}</h3>
          {product.diamonds && (
            <div className="flex items-center gap-1">
            </div>
          )}

          <div className="space-y-0.5">
            {product.originalPrice && product.discountApplied && product.discountApplied > 0 ? (
              <p className="text-[10px] text-gray-400 line-through">
                ${product.originalPrice.toFixed(2)}
              </p>
            ) : null}
            <p className="text-sm font-bold text-black">
              ${product.price.toFixed(2)}
              {product.originalPrice && product.discountApplied && product.discountApplied > 0 && (
                <span className="text-[10px] text-green-400 ml-1">
                  (-{product.discountApplied}%)
                </span>
              )}
            </p>
            {isReseller && product.resellerPrice && (
              <p className="text-[10px] font-medium text-black">
                Reseller: ${product.resellerPrice.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {groupedProducts.special && (
        <div>
          <h3 className="text-lg font-semibold text-black mb-3 flex items-center gap-2">
            <div className="p-1.5 bg-yellow-500/10 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            Best Seller
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {groupedProducts.special.map(renderProductCard)}
          </div>
        </div>
      )}
      
      {groupedProducts.diamonds && (
        <div>
          <h3 className="text-lg font-semibold text-black mb-3 flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-lg shadow-sm">
            </div>
            Diamond Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {groupedProducts.diamonds.map(renderProductCard)}
          </div>
        </div>
      )}

      {groupedProducts.subscription && (
        <div>
          <h3 className="text-lg font-semibold text-black mb-3 flex items-center gap-2">
            <div className="p-1.5 bg-purple-500/10 rounded-lg shadow-sm">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            Subscription Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {groupedProducts.subscription.map(renderProductCard)}
          </div>
        </div>
      )}

      {products.length === 0 && (
        <div className="text-center py-10">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 shadow-lg">
            <Sparkles className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-black">
              No products available for {
                game === 'mlbb' ? 'Mobile Legends' :
                game === 'mlbb_ph' ? 'Mobile Legends PH' :
                game === 'freefire' ? 'Free Fire' :
                'Free Fire TH'
              }.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Please check back later for new products.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
