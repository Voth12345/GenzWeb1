import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Check, Loader2, AlertCircle, Timer, CheckCircle, Download } from 'lucide-react';
import { TopUpForm } from '../types';
import axios from 'axios';
import { getConfig, getPaymentConfig } from '../lib/config';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';

interface Props {
  form: TopUpForm;
  orderFormat: string;
  onClose: () => void;
  discountPercent?: number;
}

export function PaymentModal({ form, orderFormat, onClose, discountPercent = 0 }: Props) {
  const config = getConfig();
  const paymentConfig = getPaymentConfig();

  const [status, setStatus] = useState<'pending' | 'success' | 'checking' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [md5Hash, setMd5Hash] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSentToTelegram, setHasSentToTelegram] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [transactionId, setTransactionId] = useState<string>('');
  const [nextCheckTime, setNextCheckTime] = useState(5);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [lastQrGeneration, setLastQrGeneration] = useState<number>(0);
  const [qrCooldown, setQrCooldown] = useState(0);

  const MAX_VERIFICATION_ATTEMPTS = 12;
  const VERIFICATION_TIMEOUT = 60000; // 60 seconds
  const QR_COOLDOWN_PERIOD = 180; // 3 minutes in seconds
  const CHECK_INTERVAL = 5000; // 5 seconds between checks

  const verificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const productName = useMemo(() => 
    form.product?.diamonds ? `${form.product.diamonds} diamond` : form.product?.name || '',
    [form.product]
  );

  const finalAmount = useMemo(() => {
    if (!form.product?.price) return 0;
    const discount = (form.product.price * discountPercent) / 100;
    const amount = form.product.price - discount;
    return Math.round(amount * 100) / 100;
  }, [form.product?.price, discountPercent]);

  const cleanup = useCallback(() => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
    }
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
      qrTimeoutRef.current = null;
    }
    if (checkCountdownRef.current) {
      clearInterval(checkCountdownRef.current);
      checkCountdownRef.current = null;
    }
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
      verificationTimeoutRef.current = null;
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startCheckCountdown = () => {
    setNextCheckTime(5);
    const interval = setInterval(() => {
      setNextCheckTime(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    checkCountdownRef.current = interval;
  };

  const startQrCooldown = () => {
    setQrCooldown(QR_COOLDOWN_PERIOD);
    const interval = setInterval(() => {
      setQrCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    cooldownIntervalRef.current = interval;
  };

  const verifyCurrentPrice = async () => {
    try {
      // Determine the correct product table based on the game
      let tableName: string;
      switch (form.game) {
        case 'mlbb':
          tableName = 'mlbb_products';
          break;
        case 'mlbb_ph':
          tableName = 'mlbb_ph_products';
          break;
        case 'freefire':
          tableName = 'freefire_products';
          break;
        case 'freefire_th':
          tableName = 'freefire_th_products';
          break;
        default:
          tableName = 'freefire_products'; // Default fallback
      }

      const { data: products } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', form.product?.id)
        .single();

      if (products) {
        const currentPrice = products.price;
        const isReseller = localStorage.getItem('genz_reseller_auth') === 'true';

        if (isReseller) {
          const { data: resellerPrice } = await supabase
            .from('reseller_prices')
            .select('price')
            .eq('product_id', form.product?.id)
            .eq('game', form.game)
            .single();

          if (resellerPrice) {
            return resellerPrice.price;
          }
        }

        return currentPrice;
      }
      return null;
    } catch (error) {
      console.error('Error verifying current price:', error);
      return null;
    }
  };

const sendToTelegram = async () => {
  if (hasSentToTelegram) return;

  try {
    const currentPrice = await verifyCurrentPrice();
    if (currentPrice === null) {
      throw new Error('Failed to verify current price');
    }

    const expectedFinalAmount = Math.round((currentPrice * (100 - discountPercent)) / 100 * 100) / 100;

    if (Math.abs(expectedFinalAmount - finalAmount) > 0.01) {
      throw new Error('Price has changed. Please refresh and try again.');
    }

    const txId = `tb${Math.floor(100000 + Math.random() * 900000)}`;
    setTransactionId(txId);

    const orderId = Date.now().toString();

    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('create_payment_token', {
        order_info: {
          transactionId: txId,
          game: form.game,
          amount: finalAmount,
          item: form.product?.name,
          userId: form.userId,
          serverId: form.game === 'freefire' || form.game === 'freefire_th' ? '0' : form.serverId,
          orderId: orderId,
          orderDate: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }),
          mainMessage: form.game === 'mlbb' || form.game === 'mlbb_ph'
            ? `/br ${form.userId} ${form.game === 'freefire' || form.game === 'freefire_th' ? '0' : form.serverId} ${form.product?.code || form.product?.diamonds || form.product?.name}`
            : `${form.userId} ${form.game === 'freefire' || form.game === 'freefire_th' ? '0' : form.serverId} ${form.product?.code || form.product?.diamonds || form.product?.name}`,
          orderMessage: `Top up successful✅\n\n` +
            `-Transaction: ${txId}\n` +
            `-Game: ${
              form.game === 'mlbb' ? 'Mobile Legends' :
              form.game === 'mlbb_ph' ? 'Mobile Legends PH' :
              form.game === 'freefire' ? 'Free Fire' :
              'Free Fire TH'
            }\n` +
            `-Amount: ${finalAmount} $\n` +
            `-Item: ${form.product?.name}\n` +
            `-User ID: ${form.userId}\n` +
            `-Server ID: ${form.game === 'freefire' || form.game === 'freefire_th' ? '0' : form.serverId}\n` +
            `-Order ID: S${orderId}\n` +
            `-Order Date: ${new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })}`
        }
      });

    if (tokenError || !tokenResult) {
      throw new Error('Failed to generate payment token');
    }

    const response = await axios.post('/api/telegram', {}, {
      headers: {
        'Authorization': `Bearer ${tokenResult}`
      }
    });

    if (!response.data.success) {
      throw new Error('Failed to send message to Telegram');
    }

    setHasSentToTelegram(true);
  } catch (error) {
    console.error('Error sending to Telegram:', error);
    setErrorMessage(error instanceof Error ? error.message : 'Failed to send order confirmation. Please try again.');
    setStatus('error');
  }
};

  const verifyPayment = useCallback(async () => {
    if (!md5Hash || isProcessing || status === 'success') return false;

    setIsProcessing(true);
    try {
      const response = await axios.post('/api/verify-payment', { md5: md5Hash });
      
      if (response.data?.responseCode === 0) {
        cleanup();

        if (status !== 'success') {
          setStatus('success');
          setShowSuccessAnimation(true);

          const secondVerification = await axios.post('/api/verify-payment', { md5: md5Hash });
          if (secondVerification.data?.responseCode === 0 && !hasSentToTelegram) {
            await sendToTelegram();
          }
        }
        return true;
      }
      
      if (response.data?.responseCode === 1) {
        return false;
      }

      cleanup();
      setStatus('error');
      setErrorMessage('Payment verification failed. Please try again or contact support.');
      return false;

    } catch (error) {
      console.error('Payment verification failed:', error);
      cleanup();
      setStatus('error');
      setErrorMessage('Payment verification failed. Please try again or contact support.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [md5Hash, cleanup, sendToTelegram, isProcessing, status, hasSentToTelegram]);

  const startRandomInterval = () => {
    startCheckCountdown();
    verificationIntervalRef.current = setTimeout(async () => {
      if (!isProcessing) {
        setCheckCount(prev => prev + 1);
        await verifyPayment();
      }
      startRandomInterval();
    }, CHECK_INTERVAL);

    verificationTimeoutRef.current = setTimeout(() => {
      cleanup();
      setAutoCheckEnabled(false);
      setStatus('error');
      setErrorMessage('Payment verification timeout. Please try again or contact support if payment was made.');
    }, VERIFICATION_TIMEOUT);
  };

  useEffect(() => {
    if (md5Hash && !verificationIntervalRef.current) {
      setAutoCheckEnabled(true);
      setVerificationAttempts(0);

      const firstCheckTimeout = setTimeout(() => {
        verifyPayment();
        startRandomInterval();
      }, 7000);

      qrTimeoutRef.current = setTimeout(() => {
        cleanup();
        setAutoCheckEnabled(false);
        setStatus('error');
        setErrorMessage('QR code has expired. Please try again.');
      }, 300000);

      return () => {
        clearTimeout(firstCheckTimeout);
        clearTimeout(verificationIntervalRef.current);
        clearTimeout(qrTimeoutRef.current);
        verificationIntervalRef.current = null;
        qrTimeoutRef.current = null;
      };
    }
  }, [md5Hash, isProcessing, verifyPayment, cleanup]);

  useEffect(() => {
    const generateKHQR = async () => {
      if (isProcessing || finalAmount < 0.01 || qrCode || qrCooldown > 0) return;
      
      const now = Date.now();
      if (now - lastQrGeneration < QR_COOLDOWN_PERIOD * 1000) {
        const remainingCooldown = Math.ceil((QR_COOLDOWN_PERIOD * 1000 - (now - lastQrGeneration)) / 1000);
        setQrCooldown(remainingCooldown);
        startQrCooldown();
        return;
      }
      
      setStatus('checking');
      setErrorMessage('');
      setIsProcessing(true);
      
      try {
        if (finalAmount < 0.01) {
          throw new Error('Amount must be at least 0.01 USD. Please remove the promo code for small purchases.');
        }

        const payload = {    
          bakongAccountID: paymentConfig.khqr.accountId,
          accName: paymentConfig.khqr.accountName,
          accountInformation: paymentConfig.khqr.accountInformation,
          currency: paymentConfig.khqr.currency,
          amount: finalAmount,
          address: paymentConfig.khqr.address
        };

        const response = await axios.post('/api/khqr', payload);

        if (response.status === 200 || response.status === 201) {
          const { success, qrImage, md5 } = response.data;
          if (success && qrImage && md5) {
            setQrCode(qrImage);
            setMd5Hash(md5);
            setLastQrGeneration(now);
          } else {
            throw new Error('Invalid response from QR code generator');
          }
        } else {
          throw new Error(`Server returned status ${response.status}`);
        }
      } catch (error) {
        let errorMessage = 'Failed to generate QR code';
        if (axios.isAxiosError(error)) {
          errorMessage = error.response?.data?.message || 'Network error. Please try again.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        setStatus('error');
        setErrorMessage(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    };

    generateKHQR();
  }, [finalAmount, isProcessing, lastQrGeneration, paymentConfig.khqr, qrCode, qrCooldown]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const handleContinueShopping = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDownloadQrCode = useCallback(() => {
    if (!qrCode) return;
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `KHQR_Payment_${transactionId || 'QR'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [qrCode, transactionId]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#f9fafb',
        scale: 2,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Receipt_${transactionId || 'Transaction'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating receipt image:', error);
      setErrorMessage('Failed to download receipt. Please try again.');
    }
  }, [transactionId]);

  const successReceipt = useMemo(() => (
    <div ref={receiptRef} className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-green-700">ការទិញរបស់អ្នកត្រូវបានជោគជ័យ</h3>
      </div>
      <div className="space-y-3 text-gray-700 text-sm">
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <h4 className="font-semibold">Product</h4>
          <p>{productName}</p>
        </div>
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <h4 className="font-semibold">USER ID</h4>
          <p>{form.userId}</p>
        </div>
        {(form.game === 'mlbb' || form.game === 'mlbb_ph' || form.game === 'freefire' || form.game === 'freefire_th') && (
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <h4 className="font-semibold">SERVER ID</h4>
            <p>{form.game === 'freefire' || form.game === 'freefire_th' ? '0' : form.serverId}</p>
          </div>
        )}
        {form.nickname && (
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <h4 className="font-semibold">NICKNAME</h4>
            <p>{form.nickname}</p>
          </div>
        )}
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <h4 className="font-semibold">PAYMENT</h4>
          <p>KHQR</p>
        </div>
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <h4 className="font-semibold">PRICE</h4>
          <p>{finalAmount.toFixed(2)} USD</p>
        </div>
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <h4 className="font-semibold">TRANSACTION ID</h4>
          <p>{transactionId}</p>
        </div>
      </div>
      <div className="text-center text-xs text-gray-500 pt-2">
        <p>សូមថតវិក័យបត្រទុកដើម្បីផ្ទៀងផ្ទាត់</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleDownloadReceipt}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-all duration-300 text-sm font-medium transform hover:scale-105"
        >
          <div className="flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            <span>Download Receipt</span>
          </div>
        </button>
        <button
          onClick={handleContinueShopping}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-all duration-300 text-sm font-medium transform hover:scale-105"
        >
          ទិញបន្តទៀត
        </button>
      </div>
    </div>
  ), [form.userId, form.serverId, form.nickname, form.game, productName, finalAmount, transactionId, handleContinueShopping, handleDownloadReceipt]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-4 max-w-md w-full relative shadow-2xl border border-gray-200 transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
        <div className="bg-red-600 text-white rounded-t-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://play-lh.googleusercontent.com/ABNDYwddbqTFpqp809iNq3r9LjrE2qTZ8xFqWmc-iLfHe2vyPAPwZrN_4S1QCFaLDYE=w240-h480-rw"
              alt="KHQR Logo"
              className="w-6 h-6"
            />
            <span className="font-semibold text-sm">KHQR GENZ TOPUP</span>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative z-10 space-y-4 pt-4">
          {status === 'success' ? (
            successReceipt
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">Scan with Bakong</h4>
                    <p className="text-xs text-gray-500">QR code expires in 5 minutes</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{finalAmount.toFixed(2)} USD</p>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
{qrCode ? (
  <div className="flex flex-col items-center">
    <div className="relative w-full max-w-[200px] mx-auto">
      <img
        src={qrCode}
        alt="KHQR Code"
        className="w-full border border-gray-200 rounded-lg shadow-sm"
        loading="lazy"
      />
      {/* SVG Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 148 149"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10" // Adjust size as needed
        >
          <circle cx="74.0625" cy="74.3535" r="73.9375" fill="white" />
          <circle cx="74.0609" cy="74.3522" r="62.3392" fill="black" />
          <path
            d="M74.2514 101.046C69.3109 101.046 65.2023 100.34 61.9254 98.9283C58.6486 97.4663 56.1784 95.4246 54.5147 92.8031C52.8511 90.1312 52.0193 87.0056 52.0193 83.4263H63.1354C63.1354 84.8379 63.5135 86.1738 64.2696 87.4341C65.0258 88.6441 66.2357 89.6271 67.8994 90.3833C69.563 91.0891 71.6803 91.442 74.2514 91.442C77.6795 91.442 80.301 90.837 82.1158 89.6271C83.9811 88.4172 84.9137 86.804 84.9137 84.7875C84.9137 83.023 84.1323 81.5863 82.5695 80.4772C81.0067 79.3177 78.5113 78.5615 75.0832 78.2086L71.2266 77.9061C65.8324 77.402 61.5473 75.7888 58.3713 73.0665C55.1953 70.2938 53.6073 66.3868 53.6073 61.3455C53.6073 57.867 54.3887 54.9682 55.9515 52.6492C57.5143 50.2798 59.7577 48.5154 62.6816 47.3559C65.6056 46.146 69.1093 45.541 73.1927 45.541C77.5787 45.541 81.2588 46.2216 84.2332 47.5827C87.2075 48.9439 89.4509 50.91 90.9633 53.481C92.5261 56.0521 93.3075 59.1777 93.3075 62.8578H82.1914C82.1914 61.3959 81.8386 60.1103 81.1328 59.0013C80.4774 57.8418 79.4944 56.9091 78.1836 56.2033C76.8729 55.4976 75.2093 55.1447 73.1927 55.1447C71.4283 55.1447 69.9159 55.3967 68.6556 55.9009C67.3952 56.405 66.4374 57.136 65.782 58.0938C65.1267 59.0013 64.799 60.0851 64.799 61.3455C64.799 62.9083 65.3787 64.3198 66.5382 65.5801C67.6977 66.7901 69.6134 67.5463 72.2853 67.8487L76.1419 68.1512C82.1914 68.6553 87.0311 70.2938 90.6608 73.0665C94.2905 75.8392 96.1054 79.7462 96.1054 84.7875C96.1054 88.266 95.2484 91.2151 93.5344 93.6349C91.8203 96.0548 89.3249 97.8948 86.048 99.1552C82.8216 100.415 78.8894 101.046 74.2514 101.046ZM68.8824 110.498V99.4576H78.7886V110.498H68.8824ZM68.58 49.2464V38.2059H78.4861V49.2464H68.58Z"
            fill="white"
          />
        </svg>
      </div>
    </div>
    <button
                      onClick={handleDownloadQrCode}
                      disabled={!qrCode}
                      className="mt-4 flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm font-medium transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download QR Code</span>
                    </button>
                  </div>
                ) : qrCooldown > 0 ? (
                  <div className="text-center py-4">
                    <Timer className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-gray-600">Please wait {qrCooldown}s before generating a new QR code</p>
                  </div>
                ) : (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                )}
                <p className="text-center text-sm font-medium text-gray-700">
                  🔄 <span className="text-red-500">សូមត្រឡប់មកវិញបន្ទាប់ពីបង់ប្រាក់, ដើម្បីរង់ចាំការពិនិត្យការបង់ប្រាក់ (ហាមclear website)</span> 🔄
                </p>
                {autoCheckEnabled && (
                  <div className="text-xs text-center text-gray-500">
                    <div className="flex items-center justify-center gap-1">
                      <Timer className="w-3 h-3 animate-pulse" />
                      <span>Next check in {nextCheckTime} seconds (Check #{checkCount})</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
