import React, { useMemo, useCallback } from 'react';
import { GameProduct } from '../types';
import { Check, ShoppingCart, Star, Sparkles, Flame, Crown } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { toast } from 'react-toastify'; // Added for better notifications
import 'react-toastify/dist/ReactToastify.css'; // Import toast styles

interface Props {
  products: GameProduct[];
  selectedProduct: GameProduct | null;
  onSelect: (product: GameProduct) => void;
  onNotify: (message: string) => void;
  game: string;
}

export function ProductList({ products, selectedProduct, onSelect, onNotify, game }: Props) {
  const isReseller = localStorage.getItem('jackstore_reseller_auth') === 'true';

  // Group products by type with memoization
  const groupedProducts = useMemo(() => {
    const groups = products.reduce((acc, product) => {
      const type = product.type || 'diamonds'; // Default to diamonds if type is undefined
      if (!acc[type]) acc[type] = [];
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
    if (lowercaseTag.includes('hot')) return <Flame className="w-5 h-5" />;
    if (lowercaseTag.includes('best')) return <Star className="w-5 h-5" />;
    if (lowercaseTag.includes('new')) return <Sparkles className="w-5 h-5" />;
    if (lowercaseTag.includes('premium')) return <Crown className="w-5 h-5" />;
    return null;
  };

  // Handle product selection with callback for performance
  const handleSelect = useCallback(
    (product: GameProduct) => {
      onSelect(product);
      const message = product.diamonds
        ? `${product.diamonds} Diamonds = $${product.price.toFixed(2)}`
        : `${product.name} = $${product.price.toFixed(2)}`;
      onNotify(message); // Call parent notify
      toast.success(message, { autoClose: 3000 }); // Show toast notification
    },
    [onSelect, onNotify]
  );

  const renderProductCard = (product: GameProduct) => {
    const isSelected = selectedProduct?.id === product.id;
    const cardClass = `relative rounded-2xl cursor-pointer border p-5 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 ${
      isSelected ? 'border-2 border-blue-500 bg-blue-100/20 ring-2 ring-blue-500/50' : 'border-white/10 bg-white/5 hover:bg-white/10'
    }`;

    return (
      <div
        key={product.id}
        data-tooltip-id={`tooltip-${product.id}`}
        data-tooltip-content={product.diamonds ? `${product.diamonds} Diamonds` : product.name}
        data-tooltip-place="top"
        className={cardClass}
        onClick={() => handleSelect(product)}
        role="button"
        aria-label={`Select ${product.diamonds ? `${product.diamonds} Diamonds` : product.name} for $${product.price.toFixed(2)}`}
      >
        {/* Tagname badge with animation */}
        {product.tagname && (
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-1.5 rounded-full shadow-md flex items-center gap-2 whitespace-nowrap text-sm font-bold animate-pulse-slow">
              {getTagIcon(product.tagname)}
              <span>{product.tagname.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* Product content with enhanced vertical layout */}
        <div className={`flex flex-col items-center justify-center ${product.tagname ? 'pt-10' : ''} h-40`}>
          {/* Product image with fallback */}
          <div className="relative flex-shrink-0 mb-3">
            <img
              src={product.image || 'https://via.placeholder.com/60'}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-contain transition-transform duration-300 hover:scale-110"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60';
              }}
            />
            {isSelected && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1.5">
                <Check className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Product details with improved typography */}
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-base text-white leading-tight break-words line-clamp-2">
              {product.diamonds ? `${product.diamonds} Diamonds` : product.name}
            </h3>
            <div className="space-y-1">
              {product.originalPrice && product.discountApplied && product.discountApplied > 0 && (
                <p className="text-xs text-gray-500 line-through">
                  ${product.originalPrice.toFixed(2)}
                </p>
              )}
              <p className="text-lg font-bold text-blue-300 flex items-center justify-center gap-1.5">
                ${product.price.toFixed(2)}
                {product.originalPrice && product.discountApplied && product.discountApplied > 0 && (
                  <span className="text-xs text-green-500">(-{product.discountApplied}%)</span>
                )}
              </p>
              {isReseller && product.resellerPrice && (
                <p className="text-sm font-medium text-blue-400/90">
                  Reseller: ${product.resellerPrice.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>
        <Tooltip id={`tooltip-${product.id}`} className="bg-gray-800 text-white text-sm p-2 rounded shadow-lg" />
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Special Packages */}
      {groupedProducts.special && (
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Sparkles className="w-7 h-7 text-blue-400" />
            </div>
            Promotion Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {groupedProducts.special.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Diamonds Packages */}
      {groupedProducts.diamonds && (
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <ShoppingCart className="w-7 h-7 text-blue-400" />
            </div>
            Diamond Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {groupedProducts.diamonds.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Subscription Packages */}
      {groupedProducts.subscription && (
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Crown className="w-7 h-7 text-purple-400" />
            </div>
            Subscription Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {groupedProducts.subscription.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Empty State with animation */}
      {products.length === 0 && (
        <div className="text-center py-16">
          <div className="bg-white/10 rounded-xl p-8 border border-white/20 shadow-xl animate-fade-in">
            <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-6 animate-pulse" />
            <p className="text-white text-xl font-semibold">
              No products available for {
                game === 'mlbb' ? 'Mobile Legends' :
                game === 'mlbb_ph' ? 'Mobile Legends PH' :
                game === 'freefire' ? 'Free Fire' :
                'Free Fire TH'
              }.
            </p>
            <p className="text-gray-500 mt-3">
              Please check back later for new products.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
