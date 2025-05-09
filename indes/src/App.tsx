import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  MessageCircle,
  Facebook,
  LogOut,
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

// Constants
const STORAGE_KEYS = {
  CUSTOMER_INFO: 'customerInfo',
  RESELLER_AUTH: 'reseller_auth',
  RESELLER_USERNAME: 'reseller_username',
};

// Environment variables
const API_URLS = {
  MLBB_VALIDATE: process.env.REACT_APP_MLBB_VALIDATE_API || 'https://api.isan.eu.org/nickname/ml',
};

// Lazy-loaded pages
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const ResellerPage = lazy(() => import('./pages/ResellerPage').then(module => ({ default: module.ResellerPage })));

interface MLBBValidationResponse {
  success: boolean;
  name: string;
}

function App() {
  const [form, setForm] = useState<TopUpForm>(() => {
    const savedForm = localStorage.getItem(STORAGE_KEYS.CUSTOMER_INFO);
    return savedForm ? JSON.parse(savedForm) : {
      userId: '',
      serverId: '',
      product: null,
      game: 'mlbb',
      nickname: undefined,
    };
  });

  const [showTopUp, setShowTopUp] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderFormat, setOrderFormat] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<MLBBValidationResponse | null>(null);
  const [formErrors, setFormErrors] = useState<{ userId?: string; serverId?: string; general?: string }>({});
  const [products, setProducts] = useState<GameProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isResellerRoute, setIsResellerRoute] = useState(false);
  const [isResellerLoggedIn, setIsResellerLoggedIn] = useState(false);
  const [paymentCooldown, setPaymentCooldown] = useState(0);
  const [cooldownInterval, setCooldownInterval] = useState<NodeJS.Timeout | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showPopupBanner, setShowPopupBanner] = useState(true);

  // Route checking effect
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      setIsAdminRoute(path === '/adminlogintopup');
      setIsResellerRoute(path === '/reseller');
      setIsResellerLoggedIn(localStorage.getItem(STORAGE_KEYS.RESELLER_AUTH) === 'true');
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
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
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_INFO, JSON.stringify({
        userId: form.userId,
        serverId: form.serverId,
        game: form.game,
        product: null,
        nickname: form.nickname,
      }));
    }
  }, [form.userId, form.serverId, form.game, form.nickname]);

  const startPaymentCooldown = useCallback(() => {
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
  }, [cooldownInterval]);

  const fetchProducts = useCallback(async (game: 'mlbb' | 'freefire') => {
    setLoading(true);
    try {
      const tableName = game === 'mlbb' ? 'mlbb_products' : 'freefire_products';
      const { data, error } = await supabase.from(tableName).select('*').order('id', { ascending: true });

      if (error) throw new Error(error.message);

      let transformedProducts: GameProduct[] = data.map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds || undefined,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game,
        image: product.image || undefined,
        code: product.code || undefined,
      }));

      const isReseller = localStorage.getItem(STORAGE_KEYS.RESELLER_AUTH) === 'true';
      if (isReseller) {
        const { data: resellerPrices, error: resellerError } = await supabase
          .from('reseller_prices')
          .select('*')
          .eq('game', game);
        if (resellerError) throw new Error(resellerError.message);
        if (resellerPrices) {
          transformedProducts = transformedProducts.map(product => {
            const resellerPrice = resellerPrices.find(rp => rp.product_id === product.id && rp.game === game);
            return resellerPrice ? { ...product, price: resellerPrice.price, resellerPrice: resellerPrice.price } : product;
          });
        }
      }

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setFormErrors(prev => ({ ...prev, general: 'Failed to load products. Please try again.' }));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const validateAccount = useCallback(async () => {
    if (!form.userId || !form.serverId || form.game !== 'mlbb') return;

    const idRegex = /^\d+$/;
    if (!idRegex.test(form.userId) || !idRegex.test(form.serverId)) {
      setFormErrors({ userId: 'User ID and Server ID must be numeric' });
      return;
    }

    setValidating(true);
    setValidationResult(null);
    setFormErrors({});
    try {
      const response = await axios.get<MLBBValidationResponse>(
        `${API_URLS.MLBB_VALIDATE}?id=${form.userId}&zone=${form.serverId}`
      );
      if (response.data.success) {
        setValidationResult(response.data);
        setForm(prev => ({ ...prev, nickname: response.data.name }));
      } else {
        setFormErrors({ general: 'Account not found. Please check your User ID and Server ID.' });
      }
    } catch (error) {
      console.error('Failed to validate account:', error);
      setFormErrors({ general: 'Failed to validate account. Please try again.' });
    } finally {
      setValidating(false);
    }
  }, [form.userId, form.serverId, form.game]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (paymentCooldown > 0) return;

    const errors: { userId?: string; serverId?: string; general?: string } = {};
    const idRegex = /^\d+$/;
    if (!form.userId) errors.userId = 'User ID is required';
    else if (!idRegex.test(form.userId)) errors.userId = 'User ID must be numeric';
    if (form.game === 'mlbb' && !form.serverId) errors.serverId = 'Server ID is required';
    else if (form.game === 'mlbb' && !idRegex.test(form.serverId)) errors.serverId = 'Server ID must be numeric';
    if (!form.product) errors.general = 'Please select a product';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (form.game === 'mlbb' && !validationResult?.success) {
      setFormErrors({ general: 'Please validate your Mobile Legends account first' });
      return;
    }

    const productIdentifier = form.product.code || form.product.diamonds || form.product.name;
    const format = form.game === 'mlbb'
      ? `${form.userId} ${form.serverId} ${productIdentifier}`
      : `${form.userId} 0 ${productIdentifier}`;
    setOrderFormat(format);
    setShowCheckout(true);
  }, [form, paymentCooldown, validationResult]);

  const clearSavedInfo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_INFO);
    setForm({ userId: '', serverId: '', product: null, game: form.game, nickname: undefined });
    setValidationResult(null);
    setFormErrors({});
  }, [form.game]);

  const handleClosePayment = useCallback(() => {
    setShowCheckout(false);
    startPaymentCooldown();
  }, [startPaymentCooldown]);

  const handlePromoCode = useCallback((discount: number) => {
    setDiscountPercent(discount);
  }, []);

  const clearPromoCode = useCallback(() => {
    setDiscountPercent(0);
  }, []);

  if (isAdminRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          <span className="ml-2 text-gray-700">Loading admin panel...</span>
        </div>
      }>
        <AdminPage />
      </Suspense>
    );
  }

  if (isResellerRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          <span className="ml-2 text-gray-700">Loading reseller panel...</span>
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
    <div
      className="min-h-screen bg-fixed bg-cover bg-center flex flex-col relative"
      style={{ backgroundColor: '#f9f5fc' }}
    >
      {/* Header */}
      <nav
        className="bg-gradient-to-r from-black to-gray-800 text-white p-4 shadow-lg backdrop-blur-md sticky top-0 z-50"
        style={{
          backgroundImage: `url("${storeConfig.backgroundImageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={storeConfig.logoUrl} alt={`${storeConfig.storeName} Logo`} className="w-20 h-20 rounded-full" />
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
      <main className="flex-grow container mx-auto px-4 py-8">
        {formErrors.general && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-sm">
            {formErrors.general}
          </div>
        )}
        {!showTopUp ? (
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* MLBB */}
            <div
              onClick={() => {
                setForm(prev => ({ ...prev, game: 'mlbb' }));
                setShowTopUp(true);
              }}
              className="bg-gray-350 backdrop-blur-lg border border-stone-950 rounded-3xl p-4 text-sky-300 hover:bg-sky-50 transition-all duration-300 group cursor-pointer shadow-md hover:shadow-sky-300"
              role="button"
              aria-label="Select Mobile Legends"
            >
              <img
                src={storeConfig.games.mlbb.logoUrl}
                alt="Mobile Legends"
                className="w-20 h-20 rounded-2xl mx-auto mb-3 transform group-hover:scale-110 transition-transform"
              />
              <h3
                className="text-xl font-bold text-stone-950 text-center tracking-wide uppercase"
                style={{ fontFamily: '"Fredoka One", cursive' }}
              >
                🎮 {storeConfig.games.mlbb.name}
              </h3>
              <p className="text-xs text-center text-black mt-2 font-light">
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
              className="bg-gray-350 backdrop-blur-lg border border-stone-950 rounded-3xl p-4 text-sky-300 hover:bg-sky-50 transition-all duration-300 group cursor-pointer shadow-md hover:shadow-sky-300"
              role="button"
              aria-label="Select Free Fire"
            >
              <img
                src={storeConfig.games.freefire.logoUrl}
                alt="Free Fire"
                className="w-20 h-20 rounded-2xl mx-auto mb-3 transform group-hover:scale-110 transition-transform"
              />
              <h3
                className="text-xl font-bold text-stone-950 text-center tracking-wide uppercase"
                style={{ fontFamily: '"Fredoka One", cursive' }}
              >
                🔥 {storeConfig.games.freefire.name}
              </h3>
              <p className="text-xs text-center text-black mt-2 font-light">
                ✨ {storeConfig.games.freefire.tagline}
              </p>
              <div className="mt-4 w-full bg-gradient-to-r from-black via-gray-800 to-black text-white py-2 px-4 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-black/30 transform hover:-translate-y-1 transition-all duration-300">
                💎 Top Up Now
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowTopUp(false);
                  setShowCheckout(false);
                }}
                className="text-white hover:text-green-200 transition-colors text-sm flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg"
                aria-label="Back to game selection"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Games
              </button>
              {(form.userId || form.serverId) && (
                <button
                  onClick={clearSavedInfo}
                  className="text-red-300 hover:text-red-200 transition-colors text-sm flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg"
                  aria-label="Clear saved information"
                >
                  <XCircle className="w-4 h-4" /> Clear Saved Info
                </button>
              )}
            </div>

            {/* Top-Up Panel */}
            <div className="bg-black border border-gray-800/40 rounded-xl p-6 text-white shadow-xl">
              <div className="flex flex-col space-y-4">
                {/* Game Info Header */}
                <div className="flex items-start gap-4">
                  <img
                    src={form.game === 'mlbb' ? storeConfig.games.mlbb.logoUrl : storeConfig.games.freefire.logoUrl}
                    alt={form.game === 'mlbb' ? 'Mobile Legends' : 'Free Fire'}
                    className="w-16 h-16 rounded-xl border border-gray-800/20"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">
                      {form.game === 'mlbb' ? 'Mobile Legends' : 'Free Fire'}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={storeConfig.icons.safety}
                          alt="Safety Guarantee"
                          className="w-5 h-5"
                        />
                        <span className="text-sm text-sky-300">Safety Guarantees</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img
                          src={storeConfig.icons.delivery}
                          alt="Instant Delivery"
                          className="w-5 h-5"
                        />
                        <span className="text-sm text-sky-300">Instant Delivery</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form section */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className={`grid ${form.game === 'mlbb' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
                    {/* User ID */}
                    <div>
                      <label htmlFor="userId" className="block text-sm font-medium mb-1 text-gray-300">
                        {form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          id="userId"
                          type="text"
                          value={form.userId}
                          onChange={(e) => {
                            setForm(prev => ({ ...prev, userId: e.target.value, nickname: undefined }));
                            setValidationResult(null);
                            setFormErrors(prev => ({ ...prev, userId: undefined }));
                          }}
                          className="pl-9 w-full rounded-lg bg-black/50 border border-gray-700 px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200 text-white placeholder-gray-400 text-sm"
                          placeholder={`Enter your ${form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}`}
                          aria-describedby={formErrors.userId ? 'userId-error' : undefined}
                        />
                        {formErrors.userId && (
                          <p id="userId-error" className="text-red-400 text-xs mt-1">{formErrors.userId}</p>
                        )}
                      </div>
                    </div>

                    {/* Server ID */}
                    {form.game === 'mlbb' && (
                      <div>
                        <label htmlFor="serverId" className="block text-sm font-medium mb-1 text-gray-300">Server ID</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            id="serverId"
                            type="text"
                            value={form.serverId}
                            onChange={(e) => {
                              setForm(prev => ({ ...prev, serverId: e.target.value, nickname: undefined }));
                              setValidationResult(null);
                              setFormErrors(prev => ({ ...prev, serverId: undefined }));
                            }}
                            className="pl-9 w-full rounded-lg bg-black/50 border border-gray-700 px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200 text-white placeholder-gray-400 text-sm"
                            placeholder="Enter your Server ID"
                            aria-describedby={formErrors.serverId ? 'serverId-error' : undefined}
                          />
                          {formErrors.serverId && (
                            <p id="serverId-error" className="text-red-400 text-xs mt-1">{formErrors.serverId}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Validate Account Button */}
                    {form.game === 'mlbb' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={validateAccount}
                          disabled={!form.userId || !form.serverId || validating}
                          className="w-full bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm justify-center"
                          aria-label="Validate Mobile Legends account"
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
                          <div className="flex items-center gap-2">
                            <span className="text-sky-300">SERVER ID:</span>
                            <span className="text-white">{form.game === 'mlbb' ? form.serverId : '0'}</span>
                          </div>
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
                  </div>
                </form>
              </div>
            </div>

            {/* Submit Button */}
            <div className="sticky bottom-4 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg mt-8">
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={form.game === 'mlbb' && !validationResult?.success || !form.product || paymentCooldown > 0}
                className="w-full bg-gradient-to-r from-black to-gray-800 text-white py-3 px-6 rounded-lg hover:from-gray-900 hover:to-black transition-all duration-300 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-black disabled:hover:to-gray-800 hover:shadow-lg hover:shadow-black/20 transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                aria-label="Continue to payment"
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
      <footer className="bg-black/90 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              {isResellerLoggedIn && (
                <button
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEYS.RESELLER_AUTH);
                    localStorage.removeItem(STORAGE_KEYS.RESELLER_USERNAME);
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 bg-red-500/80 hover:bg-red-600/80 px-4 py-2 rounded-full transition-all duration-300"
                  aria-label="Logout from reseller mode"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              )}
              <a
                href={storeConfig.supportUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-yellow-500/80 hover:bg-yellow-600/80 px-4 py-2 rounded-full transition-all duration-300"
                aria-label="Contact support"
              >
                <MessageCircle className="w-4 h-4" /> Support
              </a>
              <a
                href={storeConfig.channelUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#0088CC]/80 hover:bg-[#0077B5]/80 px-4 py-2 rounded-full transition-all duration-300"
                aria-label="Visit our channel"
              >
                <svg viewBox="0 0 496 512" className="w-5 h-5 fill-current text-white">
                  <path d="M248 8C111 8 0 119 0 256S111 504 248 504 496 393 496 256 385 8 248 8zM363 176.7c-3.7 39.2-19.9 134.4-28.1 178.3-3.5 18.6-10.3 24.8-16.9 25.4-14.4 1.3-25.3-9.5-39.3-18.7-21.8-14.3-34.2-23.2-55.3-37.2-24.5-16.1-8.6-25 5.3-39.5 3.7-3.8 67.1-61.5 68.3-66.7 .2-.7 .3-3.1-1.2-4.4s-3.6-.8-5.1-.5q-3.3 .7-104.6 69.1-14.8 10.2-26.9 9.9c-8.9-.2-25.9-5-38.6-9.1-15.5-5-27.9-7.7-26.8-16.3q.8-6.7 18.5-13.7 108.4-47.2 144.6-62.3c68.9-28.6 83.2-33.6 92.5-33.8 2.1 0 6.6 .5 9.6 2.9a10.5 10.5 0 013.5 6.7A43.8 43.8 0 01363 176.7z" />
                </svg>
                <span className="text-sm font-medium">Channel</span>
              </a>
              {storeConfig.footer.facebookLink && (
                <a
                  href={storeConfig.footer.facebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#1877F2]/80 hover:bg-[#166FE5]/80 px-4 py-2 rounded-full transition-all duration-300"
                  aria-label="Visit our Facebook page"
                >
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
              )}
            </div>
            <div className="text-center text-white/60 text-sm">
              <p>{storeConfig.footer.copyright}</p>
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
