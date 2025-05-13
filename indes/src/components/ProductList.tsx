import React, { useMemo } from 'react';
import { GameProduct } from '../types';
import { Check, ShoppingCart, Star, Sparkles, Flame, Crown } from 'lucide-react';
import { Tooltip } from 'react-tooltip'; // Assuming you use a tooltip library like react-tooltip

interface Props {
  products: GameProduct[];
  selectedProduct: GameProduct | null;
  onSelect: (product: GameProduct) => void;
  onNotify: (message: string) => void;
  game: string;
}

export function ProductList({ products, selectedProduct, onSelect, onNotify, game }: Props) {
  const isReseller = localStorage.getItem('jackstore_reseller_auth') === 'true';

  // Group products by type
  const groupedProducts = useMemo(() => {
    const groups = products.reduce((acc, product) => {
      const type = product.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(product);
      return acc;
    }, {} as Record<string, GameProduct[]>);

    // Sort diamonds packages by amount
    if (groups.diamonds) {
      groups.diamonds.sort((a, b) => (a.diamonds || 0) - (b.diamonds || 0));
    }

    return groups;
  }, [products]);

  // Helper function to get tagname icon
  const getTagIcon = (tagname: string) => {
    const lowercaseTag = tagname.toLowerCase();
    if (lowercaseTag.includes('hot')) return <Flame className="w-4 h-4" />;
    if (lowercaseTag.includes('best')) return <Star className="w-4 h-4" />;
    if (lowercaseTag.includes('new')) return <Sparkles className="w-4 h-4" />;
    if (lowercaseTag.includes('premium')) return <Crown className="w-4 h-4" />;
    return null;
  };

  const renderProductCard = (product: GameProduct) => {
    const isSelected = selectedProduct?.id === product.id;
    const cardClass = `relative rounded-xl cursor-pointer border p-4 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 ${
      isSelected ? 'border-2 border-blue-500 bg-blue-100/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
    }`;

    return (
      <div
        key={product.id}
        data-tooltip-id={`tooltip-${product.id}`}
        data-tooltip-content={product.diamonds ? `${product.diamonds} Diamonds` : product.name}
        data-tooltip-place="top"
        className={cardClass}
        onClick={() => {
          onSelect(product);
          onNotify(
            product.diamonds
              ? `${product.diamonds} Diamonds = $${product.price.toFixed(2)}`
              : `${product.name} = $${product.price.toFixed(2)}`
          );
        }}
      >
        {/* Tagname badge */}
        {product.tagname && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap text-xs font-bold animate-pulse-slow">
              {getTagIcon(product.tagname)}
              <span>{product.tagname.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* Product content with vertical layout for larger cards */}
        <div className={`flex flex-col items-center justify-center ${product.tagname ? 'pt-6' : ''} h-32`}>
          {/* Product image */}
          <div className="relative flex-shrink-0 mb-2">
            <img
              src={product.image || 'https://via.placeholder.com/50'}
              alt={product.name}
              className="w-16 h-16 rounded-lg object-cover transition-transform duration-300 hover:scale-110"
              loading="lazy"
            />
            {isSelected && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1">
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Product details */}
          <div className="text-center space-y-1">
            <h3 className="font-medium text-sm text-white leading-tight break-words line-clamp-2">
              {product.diamonds ? `${product.diamonds} Diamonds` : product.name}
            </h3>
            <div className="space-y-0.5">
              {product.originalPrice && product.discountApplied && product.discountApplied > 0 && (
                <p className="text-[10px] text-gray-400 line-through">
                  ${product.originalPrice.toFixed(2)}
                </p>
              )}
              <p className="text-base font-bold text-blue-200 flex items-center justify-center gap-1">
                ${product.price.toFixed(2)}
                {product.originalPrice && product.discountApplied && product.discountApplied > 0 && (
                  <span className="text-[10px] text-green-400">(-{product.discountApplied}%)</span>
                )}
              </p>
              {isReseller && product.resellerPrice && (
                <p className="text-xs font-medium text-blue-400/80">
                  Reseller: ${product.resellerPrice.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>
        <Tooltip id={`tooltip-${product.id}`} className="bg-gray-800 text-white text-xs" />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Special Packages */}
      {groupedProducts.special && (
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            Promotion Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groupedProducts.special.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Diamonds Packages */}
      {groupedProducts.diamonds && (
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-400" />
            </div>
            Diamond Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groupedProducts.diamonds.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Subscription Packages */}
      {groupedProducts.subscription && (
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
            Subscription Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groupedProducts.subscription.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 shadow-lg">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-white text-lg font-medium">
              No products available for {
                game === 'mlbb' ? 'Mobile Legends' :
                game === 'mlbb_ph' ? 'Mobile Legends PH' :
                game === 'freefire' ? 'Free Fire' :
                'Free Fire TH'
              }.
            </p>
            <p className="text-gray-400 mt-2">
              Please check back later for new products.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
