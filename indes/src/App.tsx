import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import axios from 'axios';
import { GameSelector } from './components/GameSelector';
import { ProductList } from './components/ProductList';
import { PaymentModal } from './components/PaymentModal';
import { TopUpForm, GameProduct } from './types';
import { supabase } from './lib/supabase';
import storeConfig from './lib/config';
import { BannerSlider } from './components/BannerSlider';
import { PopupBanner } from './components/PopupBanner';
import { PromoCodeInput } from './components/PromoCodeInput';

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then(module => ({ default: module.AdminPage }))
);
const ResellerPage = lazy(() =>
  import('./pages/ResellerPage').then(module => ({ default: module.ResellerPage }))
);

interface MLBBValidationResponse {
  success: boolean;
  name: string;
}

function App() {
  const [form, setForm] = useState<TopUpForm>(() => {
    const savedForm = localStorage.getItem('customerInfo');
    return savedForm ? JSON.parse(savedForm) : {
      userId: '',
      serverId: '',
      product: null,
      game: 'mlbb'
    };
  });

  const [showTopUp, setShowTopUp] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [orderFormat, setOrderFormat] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<MLBBValidationResponse | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formErrors, setFormErrors] = useState<{userId?: string; serverId?: string}>({});
  const [products, setProducts] = useState<GameProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isResellerRoute, setIsResellerRoute] = useState(false);
  const [isResellerLoggedIn, setIsResellerLoggedIn] = useState(false);
  const [showPopupBanner, setShowPopupBanner] = useState(true);
  const [paymentCooldown, setPaymentCooldown] = useState(0);
  const [cooldownInterval, setCooldownInterval] = useState<NodeJS.Timeout | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Route checking effect
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      setIsAdminRoute(path === '/adminlogintopup');
      setIsResellerRoute(path === '/reseller');
      const resellerAuth = localStorage.getItem('jackstore_reseller_auth');
      setIsResellerLoggedIn(resellerAuth === 'true');
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  // Fetch products on game change
  useEffect(() => {
    if (!isAdminRoute && !isResellerRoute) {
      fetchProducts(form.game);
    }
  }, [form.game, isAdminRoute, isResellerRoute]);

  // Cleanup interval
  useEffect(() => {
    return () => {
      if (cooldownInterval) clearInterval(cooldownInterval);
    };
  }, [cooldownInterval]);

  // Save form to localStorage
  useEffect(() => {
    if (form.userId || form.serverId) {
      localStorage.setItem('customerInfo', JSON.stringify({
        userId: form.userId,
        serverId: form.serverId,
        game: form.game,
        product: null
      }));
    }
  }, [form.userId, form.serverId, form.game]);

  const startPaymentCooldown = () => {
    setPaymentCooldown(7);
    if (cooldownInterval) clearInterval(cooldownInterval);
    const interval = setInterval(() => {
      setPaymentCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setCooldownInterval(interval);
  };

  const fetchProducts = async (game: 'mlbb' | 'freefire') => {
    setLoading(true);
    try {
      let data;
      let error;
      const isReseller = localStorage.getItem('genzstore_reseller_auth') === 'true';
      if (game === 'mlbb') {
        const response = await supabase.from('mlbb_products').select('*').order('id', { ascending: true });
        data = response.data;
        error = response.error;
      } else {
        const response = await supabase.from('freefire_products').select('*').order('id', { ascending: true });
        data = response.data;
        error = response.error;
      }
      if (error) throw error;

      let transformedProducts: GameProduct[] = data.map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds || undefined,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game: game,
        image: product.image || undefined,
        code: product.code || undefined
      }));

      if (isReseller) {
        const resellerPricesResponse = await supabase.from('reseller_prices').select('*').eq('game', game);
        if (!resellerPricesResponse.error && resellerPricesResponse.data) {
          const resellerPrices = resellerPricesResponse.data;
          transformedProducts = transformedProducts.map(product => {
            const resellerPrice = resellerPrices.find(rp => rp.product_id === product.id && rp.game === product.game);
            if (resellerPrice) {
              return {
                ...product,
                price: resellerPrice.price,
                resellerPrice: resellerPrice.price
              };
            }
            return product;
          });
        }
      }

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const validateAccount = async () => {
    if (!form.userId || !form.serverId || form.game !== 'mlbb') return;
    setValidating(true);
    setValidationResult(null);
    try {
      const response = await axios.get<MLBBValidationResponse>(
        `https://api.isan.eu.org/nickname/ml?id=${form.userId}&zone=${form.serverId}`
      );
      if (response.data.success) {
        setValidationResult(response.data);
        setForm(prev => ({ ...prev, nickname: response.data.name }));
      } else {
        setValidationResult({ success: false, name: '' });
      }
    } catch (error) {
      console.error('Failed to validate account:', error);
      setValidationResult({ success: false, name: '' });
    } finally {
      setValidating(false);
      setPaymentCooldown(0);
      if (cooldownInterval) clearInterval(cooldownInterval);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentCooldown > 0) return;

    const errors: { userId?: string; serverId?: string } = {};
    if (!form.userId) errors.userId = 'User ID is required';
    if (form.game === 'mlbb' && !form.serverId) errors.serverId = 'Server ID is required';
    if (!form.product) return alert('Please select a product');

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (form.game === 'mlbb' && !validationResult?.success) {
      return alert('Please check your Mobile Legends account first');
    }

    const productIdentifier = form.product.code || form.product.diamonds || form.product.name;
    const format = form.game === 'mlbb'
      ? `${form.userId} ${form.serverId} ${productIdentifier}`
      : `${form.userId} 0 ${productIdentifier}`;
    setOrderFormat(format);
    setShowCheckout(true);
    startPaymentCooldown();
  };

  const clearSavedInfo = () => {
    localStorage.removeItem('customerInfo');
    setForm({ userId: '', serverId: '', product: null, game: form.game });
    setValidationResult(null);
  };

  const handleClosePayment = () => {
    setShowCheckout(false);
    setShowPayment(false);
    startPaymentCooldown();
  };

  const handlePromoCode = (discount: number) => {
    setDiscountPercent(discount);
  };

  const clearPromoCode = () => {
    setDiscountPercent(0);
  };

  if (isAdminRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          <span className="ml-2 text-gray-300">Loading admin panel...</span>
        </div>
      }>
        <AdminPage />
      </Suspense>
    );
  }

  if (isResellerRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          <span className="ml-2 text-gray-300">Loading reseller panel...</span>
        </div>
      }>
        <ResellerPage onLogin={() => {
          setIsResellerLoggedIn(true);
          window.location.href = '/';
        }} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-black/90 bg-fixed bg-cover bg-center flex flex-col relative">
      {/* Header */}
      <nav
        className={`bg-gradient-to-r from-black to-gray-800 text-white p-4 shadow-lg backdrop-blur-md sticky top-0 z-50`}
        style={{
          backgroundImage: `url("${storeConfig.backgroundImageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={storeConfig.logoUrl} alt="Logo" className="w-20 h-20 rounded-full" />
            <div>
              <h1 className="text-3xl font-black text-gray-300 tracking-tight whitespace-nowrap">
                {storeConfig.storeName}
              </h1>
              <p className="text-xs text-white/80">{storeConfig.storeTagline}</p>
              {isResellerLoggedIn && (
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-medium">
                  Reseller Mode
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!showTopUp ? (
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* MLBB */}
            <div
              onClick={() => {
                setForm(prev => ({ ...prev, game: 'mlbb' }));
                setShowTopUp(true);
              }}
              className="bg-gray-900 backdrop-blur-lg border border-gray-700 rounded-3xl p-4 text-sky-300 hover:bg-gray-800 transition-all duration-300 group cursor-pointer shadow-md hover:shadow-sky-300"
            >
              <img
                src={storeConfig.games.mlbb.logoUrl}
                alt="Mobile Legends"
                className="w-20 h-20 rounded-2xl mx-auto mb-3 transform group-hover:scale-110 transition-transform"
              />
              <h3
                className="text-xl font-bold text-white text-center tracking-wide uppercase"
                style={{ fontFamily: '"Fredoka One", cursive' }}
              >
                🎮 {storeConfig.games.mlbb.name}
              </h3>
              <p className="text-xs text-center text-gray-300 mt-2 font-light">
                ✨ {storeConfig.games.mlbb.tagline}
              </p>
              <div className="mt-4 w-full bg-gradient-to-r from-black via-gray-800 to-black text-white py-2 px-4 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-black/30 transform hover:-translate-y-1 transition-all duration-300">
                💎 Top Up Now
              </div>
            </div>
            {/* Free Fire */}
            <div
              onClick={() => {
                setForm(prev => ({ ...prev, game: 'freefire' }));
                setShowTopUp(true);
              }}
              className="bg-gray-900 backdrop-blur-lg border border-gray-700 rounded-3xl p-4 text-sky-300 hover:bg-gray-800 transition-all duration-300 group cursor-pointer shadow-md hover:shadow-sky-300"
            >
              <img
                src={storeConfig.games.freefire.logoUrl}
                alt="Free Fire"
                className="w-20 h-20 rounded-2xl mx-auto mb-3 transform group-hover:scale-110 transition-transform"
              />
              <h3
                className="text-xl font-bold text-white text-center tracking-wide uppercase"
                style={{ fontFamily: '"Fredoka One", cursive' }}
              >
                🔥 {storeConfig.games.freefire.name}
              </h3>
              <p className="text-xs text-center text-gray-300 mt-2 font-light">
                ✨ {storeConfig.games.freefire.tagline}
              </p>
              <div className="mt-4 w-full bg-gradient-to-r from-black via-gray-800 to-black text-white py-2 px-4 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-black/30 transform hover:-translate-y-1 transition-all duration-300">
                💎 Top Up Now
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 bg-black rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowTopUp(false);
                  setShowCheckout(false);
                }}
                className="text-white hover:text-green-200 transition-colors text-sm flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Games
              </button>
              {(form.userId || form.serverId) && (
                <button
                  onClick={clearSavedInfo}
                  className="text-red-300 hover:text-red-200 transition-colors text-sm flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg"
                >
                  <XCircle className="w-4 h-4" /> Clear Saved Info
                </button>
              )}
            </div>

            {/* Top-Up Panel */}
            <div className="bg-black border border-gray-800/40 rounded-xl p-6 text-white shadow-xl">
              <div className="flex flex-col space-y-4">
                <div className="flex items-start gap-4">
                  <img
                    src={
                      form.game === 'mlbb'
                        ? "https://play-lh.googleusercontent.com/M9_okpLdBz0unRHHeX7FcZxEPLZDIQNCGEBoql7MxgSitDL4wUy4iYGQxfvqYogexQ "
                        : "https://play-lh.googleusercontent.com/WWcssdzTZvx7Fc84lfMpVuyMXg83_PwrfpgSBd0IID_IuupsYVYJ34S9R2_5x57gHQ "
                    }
                    alt={form.game === 'mlbb' ? "Mobile Legends" : "Free Fire"}
                    className="w-16 h-16 rounded-xl border border-gray-800/20"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">
                      {form.game === 'mlbb' ? 'Mobile Legends' : 'Free Fire'}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://raw.githubusercontent.com/Cheagjihvg/feliex-assets/main/48_-Protected_System-_Yellow-512-removebg-preview.png "
                          alt="Safety Guarantee"
                          className="w-5 h-5"
                        />
                        <span className="text-sm text-sky-300">Safety Guarantees</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img
                          src="https://raw.githubusercontent.com/Cheagjihvg/feliex-assets/main/IMG_1820.PNG "
                          alt="Instant Delivery"
                          className="w-5 h-5"
                        />
                        <span className="text-sm text-sky-300">Instant Delivery</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form section */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* User ID and Server ID Section */}
                  <div className={`grid ${form.game === 'mlbb' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    {/* User ID */}
                    <div className="w-full">
                      <label className="block text-sm font-medium mb-1 text-gray-300">
                        {form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="number"
                          value={form.userId}
                          onChange={(e) => {
                            setForm(prev => ({ ...prev, userId: e.target.value, nickname: undefined }));
                            setValidationResult(null);
                            setFormErrors(prev => ({ ...prev, userId: undefined }));
                          }}
                          className="pl-9 w-full rounded-lg bg-black/50 border border-gray-700 px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200 text-white placeholder-gray-400 text-sm"
                          placeholder={`Enter your ${form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}`}
                        />
                        {formErrors.userId && <p className="text-red-400 text-xs mt-1">{formErrors.userId}</p>}
                      </div>
                    </div>

                    {/* Server ID */}
                    {form.game === 'mlbb' && (
                      <div className="w-full">
                        <label className="block text-sm font-medium mb-1 text-gray-300">Server ID</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="number"
                            value={form.serverId}
                            onChange={(e) => {
                              setForm(prev => ({ ...prev, serverId: e.target.value, nickname: undefined }));
                              setValidationResult(null);
                              setFormErrors(prev => ({ ...prev, serverId: undefined }));
                            }}
                            className="pl-9 w-full rounded-lg bg-black/50 border border-gray-700 px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200 text-white placeholder-gray-400 text-sm"
                            placeholder="Enter your Server ID"
                          />
                          {formErrors.serverId && <p className="text-red-400 text-xs mt-1">{formErrors.serverId}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Validate Account Button and Result */}
                  {form.game === 'mlbb' && (
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                      <button
                        type="button"
                        onClick={validateAccount}
                        disabled={!form.userId || !form.serverId || validating}
                        className="w-full md:w-auto bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm justify-center"
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            Check ID
                          </>
                        )}
                      </button>
                      {validationResult?.success && (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Account found: {form.nickname}</span>
                        </div>
                      )}
                      {validationResult && !validationResult.success && (
                        <p className="text-red-400 text-xs">Invalid account details</p>
                      )}
                    </div>
                  )}

                  {/* Select Package */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      Select Package
                    </h3>
                    {loading ? (
                      <div className="flex justify-center items-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                        <span className="ml-2 text-white">Loading products...</span>
                      </div>
                    ) : (
                      <ProductList
                        products={products}
                        selectedProduct={form.product}
                        onSelect={(product) => setForm(prev => ({ ...prev, product }))}
                        game={form.game}
                      />
                    )}
                  </div>

                  {/* Order Summary */}
                  {form.product && (
                    <div className="bg-sky-500/20 rounded-lg p-4 border border-sky-500/30">
                      <h4 className="text-sm font-medium mb-2 text-white">Order Summary</h4>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-sky-300">ID:</span>
                          <span className="text-white">{form.userId}</span>
                        </div>
                        {form.game === 'mlbb' && (
                          <div className="flex items-center gap-2">
                            <span className="text-sky-300">SERVER ID:</span>
                            <span className="text-white">{form.serverId}</span>
                          </div>
                        )}
                        {form.game === 'freefire' && (
                          <div className="flex items-center gap-2">
                            <span className="text-sky-300">SERVER ID:</span>
                            <span className="text-white">0</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sky-300">ITEM:</span>
                          <span className="text-white">
                            {form.product.code || form.product.diamonds || form.product.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sky-300">PRICE:</span>
                          <span className="text-white">${form.product.price.toFixed(2)} USD</span>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

            <div className="sticky bottom-4 bg-black/90 backdrop-blur-md rounded-xl p-4 border border-gray-700 shadow-lg mt-8 max-w-3xl mx-auto">
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={form.game === 'mlbb' && !validationResult?.success || !form.product || paymentCooldown > 0}
                className="w-full bg-gradient-to-r from-black to-gray-800 text-white py-3 px-6 rounded-lg hover:from-gray-900 hover:to-black transition-all duration-300 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-black disabled:hover:to-gray-800 hover:shadow-lg hover:shadow-black/20 transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                {paymentCooldown > 0 ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Please wait {paymentCooldown}s
                  </>
                ) : (
                  'Continue to Payment'
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <div className="relative w-full h-[90px] overflow-hidden">
        <svg
          width="100%"
          className="hero-waves absolute top-0 left-0 z-10"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
        >
          <defs>
            <path
              id="wave-path"
              d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
            ></path>
          </defs>
          <g className="wave1">
            <use xlinkHref="#wave-path" x="50" y="3" fill="rgba(0, 0, 0, .1)" />
          </g>
          <g className="wave2">
            <use xlinkHref="#wave-path" x="50" y="0" fill="rgba(0, 0, 0, .2)" />
          </g>
          <g className="wave3">
            <use xlinkHref="#wave-path" x="50" y="4" fill="#000000" />
          </g>
        </svg>
      </div>

      <footer className="relative text-white py-12 md:py-16 overflow-hidden" style={{ backgroundColor: '#000000' }}>
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
            <div className="space-y-8">
              <div className="group relative">
                <img
                  alt="logo"
                  src={storeConfig.logoUrl}
                  className="h-16 md:h-20 mb-4 md:mb-6 rounded-full transition-all duration-300 group-hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=No+Image';
                  }}
                />
                <p className="text-gray-300 text-sm md:text-base leading-relaxed max-w-md">
                  Experience seamless online game top-up services with unbeatable deals on Mobile Legends, Free Fire, and more. Fast, secure, and reliable transactions every time.
                </p>
              </div>
              <div>
                <h4 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-white border-b border-gray-600/50 pb-2 tracking-wide">
                  Contact Us
                </h4>
                <div className="space-y-3 text-gray-300">
                  <p className="text-sm">Reach out via Telegram for inquiries (Chat only)</p>
                  <a
                    href={storeConfig.supportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-all duration-300 group/link"
                  >
                    <span className="text-sm font-medium group-hover/link:underline">Visit Support</span>
                    <svg
                      className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="space-y-8 md:space-y-10 flex flex-col justify-center items-center">
              <div>
                <h4 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-white border-b border-gray-600/50 pb-2 tracking-wide">
                  Connect With Us
                </h4>
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap gap-6 justify-center">
                    {[
                      { href: storeConfig.fb, color: 'hover:text-blue-400', icon: <path d="M12 2.04c-5.5 0-10 4.49-10 10.02c0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89c1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02" /> },
                      { href: storeConfig.channelUrl, color: 'hover:text-blue-400', icon: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19c-.14.75-.42 1-.68 1.03c-.58.05-1.02-.38-1.58-.75c-.88-.58-1.38-.94-2.23-1.5c-.94-.65-.33-1.01.21-1.59c.14-.15 2.71-2.48 2.76-2.69c.01-.05.01-.1-.02-.14c-.04-.05-.1-.03-.14-.02c-.06.02-1.49.95-4.22 2.79c-.4.27-.76.41-1.08.4c-.36-.01-1.04-.20-1.55-.37c-.63-.2-1.13-.31-1.09-.66c.02-.18.27-.36.74-.55c2.92-1.27 4.86-2.11 5.83-2.51c2.78-1.16 3.35-1.36 3.73-1.36c.08 0 .27.02.39.12c.1.08.13.19.12.27" /> },
                    ].map((social, index) => (
                      <a
                        key={index}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={`text-gray-300 ${social.color} transition-all duration-300 transform hover:scale-125 hover:shadow-lg`}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="hover:animate-pulse">
                          {social.icon}
                        </svg>
                      </a>
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={storeConfig.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 px-4 py-2 rounded-full text-sm font-medium text-white transition-all duration-300 shadow-md hover:shadow-blue-500/50 transform hover:-translate-y-0.5 animate-pulse-slow group"
                    >
                      <svg
                        className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19c-.14.75-.42 1-.68 1.03c-.58.05-1.02-.38-1.58-.75c-.88-.58-1.38-.94-2.23-1.5c-.94-.65-.33-1.01.21-1.59.14-.15 2.71-2.48 2.76-2.69c.01-.05.01-.1-.02-.14c-.04-.05-.1-.03-.14-.02c-.06.02-1.49.95-4.22 2.79c-.4.27-.76.41-1.08.4c-.36-.01-1.04-.20-1.55-.37c-.63-.2-1.13-.31-1.09-.66c.02-.18.27-.36.74-.55c2.92-1.27 4.86-2.11 5.83-2.51c2.78-1.16 3.35-1.36 3.73-1.36c.08 0 .27.02.39.12c.1.08.13.19.12.27" />
                      </svg>
                      <span className="relative">
                        Join our channel
                        <span className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                      </span>
                      <span className="text-sm animate-bounce">✨</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div>
                <h4 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-white border-b border-gray-600/50 pb-2 tracking-wide">
                  Payment Methods
                </h4>
                <div className="flex items-center gap-4 md:gap-6">
                  <img
                    alt="KHQR"
                    src="https://raw.githubusercontent.com/Cheagjihvg/svg/aee1480802998cec595324cb335444a14b4a48ea/khqr.svg"
                    className="h-10 md:h-12 transition-transform duration-300 hover:scale-110 hover:shadow-md hover:shadow-white/20"
                  />
                </div>
              </div>
              {isResellerLoggedIn && (
                <button
                  onClick={() => {
                    localStorage.removeItem('jackstore_reseller_auth');
                    localStorage.removeItem('jackstore_reseller_username');
                    window.location.reload();
                  }}
                  className="group flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-5 py-2.5 md:px-6 md:py-3 rounded-full transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-red-600/40 transform hover:-translate-y-1"
                >
                  <LogOut className="w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 group-hover:rotate-12" />
                  <span className="text-sm font-semibold tracking-wide">Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showCheckout && (
        <PaymentModal
          form={form}
          orderFormat={orderFormat}
          onClose={handleClosePayment}
          discountPercent={discountPercent}
        />
      )}
      {storeConfig.popupBanner.enabled && showPopupBanner && (
        <PopupBanner
          image={storeConfig.popupBanner.image}
          onClose={() => setShowPopupBanner(false)}
        />
      )}
    </div>
  );
}

export default App;
