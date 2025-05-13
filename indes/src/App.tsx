import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import axios from 'axios';
import { GameSelector } from './components/GameSelector';
import { ProductList } from './components/ProductList';
import { PaymentModal } from './components/PaymentModal';
import { TopUpForm, GameProduct } from './types';
import { supabase } from './lib/supabase';
import storeConfig from './lib/config';
import { PopupBanner } from './components/PopupBanner';

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
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderFormat, setOrderFormat] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<MLBBValidationResponse | null>(null);
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
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  useEffect(() => {
    if (!isAdminRoute && !isResellerRoute) {
      fetchProducts(form.game);
    }
  }, [form.game, isAdminRoute, isResellerRoute]);

  useEffect(() => {
    return () => {
      if (cooldownInterval) clearInterval(cooldownInterval);
    };
  }, [cooldownInterval]);

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
    startPaymentCooldown();
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
    <div className="min-h-screen bg-black/90 flex flex-col">
      {/* Header */}
      <nav
        className="bg-gradient-to-r from-black to-gray-800 text-white p-4 shadow-lg sticky top-0 z-50"
        style={{
          backgroundImage: `url("${storeConfig.backgroundImageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={storeConfig.logoUrl} alt="Logo" className="w-16 h-16 rounded-full" />
            <div>
              <h1 className="text-2xl font-bold text-gray-300">{storeConfig.storeName}</h1>
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
      <main className="container mx-auto px-4 py-8 flex-1">
        {!showTopUp ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            {/* MLBB */}
            <div
              onClick={() => {
                setForm(prev => ({ ...prev, game: 'mlbb' }));
                setShowTopUp(true);
              }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-white hover:bg-gray-700 transition-all duration-300 cursor-pointer"
            >
              <img
                src={storeConfig.games.mlbb.logoUrl}
                alt="Mobile Legends"
                className="w-16 h-16 rounded-lg mx-auto mb-3"
              />
              <h3 className="text-lg font-bold text-center">{storeConfig.games.mlbb.name}</h3>
              <p className="text-xs text-center text-gray-400 mt-2">{storeConfig.games.mlbb.tagline}</p>
              <div className="mt-4 w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-semibold text-center">
                Top Up Now
              </div>
            </div>
            {/* Free Fire */}
            <div
              onClick={() => {
                setForm(prev => ({ ...prev, game: 'freefire' }));
                setShowTopUp(true);
              }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-white hover:bg-gray-700 transition-all duration-300 cursor-pointer"
            >
              <img
                src={storeConfig.games.freefire.logoUrl}
                alt="Free Fire"
                className="w-16 h-16 rounded-lg mx-auto mb-3"
              />
              <h3 className="text-lg font-bold text-center">{storeConfig.games.freefire.name}</h3>
              <p className="text-xs text-center text-gray-400 mt-2">{storeConfig.games.freefire.tagline}</p>
              <div className="mt-4 w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-semibold text-center">
                Top Up Now
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-gray-900 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  setShowTopUp(false);
                  setShowCheckout(false);
                }}
                className="text-gray-300 hover:text-white transition-colors text-sm flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Games
              </button>
              {(form.userId || form.serverId) && (
                <button
                  onClick={clearSavedInfo}
                  className="text-red-400 hover:text-red-300 transition-colors text-sm flex items-center gap-2 bg-red-500/20 px-3 py-1.5 rounded-lg"
                >
                  <XCircle className="w-4 h-4" /> Clear Saved Info
                </button>
              )}
            </div>

            {/* Top-Up Panel */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img
                  src={
                    form.game === 'mlbb'
                      ? "https://play-lh.googleusercontent.com/M9_okpLdBz0unRHHeX7FcZxEPLZDIQNCGEBoql7MxgSitDL4wUy4iYGQxfvqYogexQ"
                      : "https://play-lh.googleusercontent.com/WWcssdzTZvx7Fc84lfMpVuyMXg83_PwrfpgSBd0IID_IuupsYVYJ34S9R2_5x57gHQ"
                  }
                  alt={form.game === 'mlbb' ? "Mobile Legends" : "Free Fire"}
                  className="w-12 h-12 rounded-lg border border-gray-700"
                />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {form.game === 'mlbb' ? 'Mobile Legends' : 'Free Fire'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <img
                        src="https://raw.githubusercontent.com/Cheagjihvg/feliex-assets/main/48_-Protected_System-_Yellow-512-removebg-preview.png"
                        alt="Safety Guarantee"
                        className="w-4 h-4"
                      />
                      Safety Guarantees
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <img
                        src="https://raw.githubusercontent.com/Cheagjihvg/feliex-assets/main/IMG_1820.PNG"
                        alt="Instant Delivery"
                        className="w-4 h-4"
                      />
                      Instant Delivery
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Section */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {/* User ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        type="number"
                        value={form.userId}
                        onChange={(e) => {
                          setForm(prev => ({ ...prev, userId: e.target.value, nickname: undefined }));
                          setValidationResult(null);
                          setFormErrors(prev => ({ ...prev, userId: undefined }));
                        }}
                        className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder={`Enter your ${form.game === 'mlbb' ? 'User ID' : 'Free Fire ID'}`}
                      />
                      {formErrors.userId && <p className="text-red-400 text-xs mt-1">{formErrors.userId}</p>}
                    </div>
                  </div>

                  {/* Server ID */}
                  {form.game === 'mlbb' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Server ID</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                          type="number"
                          value={form.serverId}
                          onChange={(e) => {
                            setForm(prev => ({ ...prev, serverId: e.target.value, nickname: undefined }));
                            setValidationResult(null);
                            setFormErrors(prev => ({ ...prev, serverId: undefined }));
                          }}
                          className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Enter your Server ID"
                        />
                        {formErrors.serverId && <p className="text-red-400 text-xs mt-1">{formErrors.serverId}</p>}
                      </div>
                    </div>
                  )}

                  {/* Validate Account */}
                  {form.game === 'mlbb' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={validateAccount}
                        disabled={!form.userId || !form.serverId || validating}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
                          Account found: {form.nickname}
                        </div>
                      )}
                      {validationResult && !validationResult.success && (
                        <p className="text-red-400 text-xs">Invalid account details</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Select Package */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Select Package</h3>
                  {loading ? (
                    <div className="flex justify-center items-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
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
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Order Summary</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span>ID:</span>
                        <span>{form.userId}</span>
                      </div>
                      {form.game === 'mlbb' && (
                        <div className="flex justify-between">
                          <span>SERVER ID:</span>
                          <span>{form.serverId}</span>
                        </div>
                      )}
                      {form.game === 'freefire' && (
                        <div className="flex justify-between">
                          <span>SERVER ID:</span>
                          <span>0</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>ITEM:</span>
                        <span>{form.product.code || form.product.diamonds || form.product.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PRICE:</span>
                        <span>${form.product.price.toFixed(2)} USD</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={form.game === 'mlbb' && !validationResult?.success || !form.product || paymentCooldown > 0}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <img src={storeConfig.logoUrl} alt="Logo" className="h-12 rounded-full" />
              <p className="text-gray-400 text-sm">
                Experience seamless online game top-up services with unbeatable deals on Mobile Legends, Free Fire, and more.
              </p>
              <div>
                <h4 className="text-lg font-bold text-white mb-2">Contact Us</h4>
                <p className="text-gray-400 text-sm">Reach out via Telegram for inquiries (Chat only)</p>
                <a
                  href={storeConfig.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Visit Support
                </a>
              </div>
            </div>
            <div className="space-y-4 flex flex-col items-center">
              <div>
                <h4 className="text-lg font-bold text-white mb-2">Connect With Us</h4>
                <div className="flex gap-4">
                  <a href={storeConfig.fb} target="_blank" rel="noreferrer noopener" className="text-gray-400 hover:text-blue-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02c0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89c1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02" />
                    </svg>
                  </a>
                  <a href={storeConfig.channelUrl} target="_blank" rel="noreferrer noopener" className="text-gray-400 hover:text-blue-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19c-.14.75-.42 1-.68 1.03c-.58.05-1.02-.38-1.58-.75c-.88-.58-1.38-.94-2.23-1.5c-.94-.65-.33-1.01.21-1.59c.14-.15 2.71-2.48 2.76-2.69c.01-.05.01-.1-.02-.14c-.04-.05-.1-.03-.14-.02c-.06.02-1.49.95-4.22 2.79c-.4.27-.76.41-1.08.4c-.36-.01-1.04-.20-1.55-.37c-.63-.2-1.13-.31-1.09-.66c.02-.18.27-.36.74-.55c2.92-1.27 4.86-2.11 5.83-2.51c2.78-1.16 3.35-1.36 3.73-1.36c.08 0 .27.02.39.12c.1.08.13.19.12.27" />
                    </svg>
                  </a>
                </div>
                <a
                  href={storeConfig.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium text-center hover:bg-blue-700"
                >
                  Join our channel
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-2">Payment Methods</h4>
                <img
                  alt="KHQR"
                  src="https://raw.githubusercontent.com/Cheagjihvg/svg/aee1480802998cec595324cb335444a14b4a48ea/khqr.svg"
                  className="h-8"
                />
              </div>
              {isResellerLoggedIn && (
                <button
                  onClick={() => {
                    localStorage.removeItem('jackstore_reseller_auth');
                    localStorage.removeItem('jackstore_reseller_username');
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
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
