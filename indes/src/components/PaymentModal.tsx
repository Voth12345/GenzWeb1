import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, CheckCircle, Loader2, AlertCircle, Timer } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { getConfig, getPaymentConfig } from '../lib/config';

// Type Definitions
interface TopUpForm {
  game: 'mlbb' | 'freefire';
  userId: string;
  serverId?: string;
  nickname?: string;
  product?: {
    name?: string;
    diamonds?: number;
    price?: number;
    code?: string;
  };
}

interface Props {
  form: TopUpForm;
  orderFormat: string;
  onClose: () => void;
  discountPercent?: number;
}

interface KhqrResponse {
  success: boolean;
  qrImage: string;
  md5: string;
}

interface VerifyPaymentResponse {
  responseCode: number;
  message?: string;
}

// Constants
const MAX_VERIFICATION_ATTEMPTS = 12;
const VERIFICATION_TIMEOUT = 60000; // 60 seconds
const QR_COOLDOWN_PERIOD = 180; // 3 minutes
const CHECK_INTERVAL = 5000; // 5 seconds
const QR_EXPIRY = 300000; // 5 minutes

// Custom Hook for Countdown Timer
const useCountdown = (initialSeconds: number) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setSeconds(initialSeconds);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return initialSeconds;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initialSeconds]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { seconds, start, stop, intervalRef };
};

// Custom Hook for Payment Verification
const usePaymentVerification = (
  md5Hash: string,
  sendToTelegram: () => Promise<void>,
  setStatus: React.Dispatch<React.SetStateAction<'pending' | 'success' | 'checking' | 'error'>>
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const telegramSentRef = useRef(false); // Prevents double Telegram send

  const verifyPayment = useCallback(async () => {
    if (!md5Hash || isProcessing) return false;

    setIsProcessing(true);
    try {
      const response = await axios.post<VerifyPaymentResponse>('/api/verify-payment', { md5: md5Hash });

      if (response.data.responseCode === 0) {
        setStatus('success');
        if (!telegramSentRef.current) {
          telegramSentRef.current = true;
          await sendToTelegram();
        }
        return true;
      }

      if (response.data.responseCode === 1) {
        return false; // Transaction not found, continue checking
      }

      throw new Error(response.data.message || 'Payment verification failed');
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('error');
      setIsProcessing(false); // Ensure isProcessing is reset
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [md5Hash, isProcessing, sendToTelegram, setStatus]);

  const startVerification = useCallback(() => {
    setAutoCheckEnabled(true);
    setCheckCount(0);

    const firstCheck = setTimeout(async () => {
      const success = await verifyPayment();
      if (!success) {
        verificationIntervalRef.current = setInterval(async () => {
          setCheckCount((prev) => prev + 1);
          await verifyPayment();
        }, CHECK_INTERVAL);
      }
    }, 7000);

    verificationTimeoutRef.current = setTimeout(() => {
      setAutoCheckEnabled(false);
      setStatus('error');
    }, VERIFICATION_TIMEOUT);

    return () => {
      clearTimeout(firstCheck);
      if (verificationIntervalRef.current) clearInterval(verificationIntervalRef.current);
      if (verificationTimeoutRef.current) clearTimeout(verificationTimeoutRef.current);
    };
  }, [verifyPayment, setStatus]);

  const cleanup = useCallback(() => {
    if (verificationIntervalRef.current) clearInterval(verificationIntervalRef.current);
    if (verificationTimeoutRef.current) clearTimeout(verificationTimeoutRef.current);
    verificationIntervalRef.current = null;
    verificationTimeoutRef.current = null;
    setAutoCheckEnabled(false);
  }, []);

  return { verifyPayment, startVerification, cleanup, checkCount, autoCheckEnabled, isProcessing };
};

// Success Receipt Component
const SuccessReceipt: React.FC<{
  form: TopUpForm;
  productName: string;
  finalAmount: number;
  transactionId: string;
  onContinue: () => void;
}> = ({ form, productName, finalAmount, transactionId, onContinue }) => (
  <div className="bg-white rounded-lg p-4 shadow-lg space-y-3">
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      <h3 className="text-xl font-bold text-green-700">ការទិញរបស់អ្នកត្រូវបានជោគជ័យ</h3>
    </div>
    <div className="space-y-2 text-gray-700">
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">Product</h4>
        <p>{productName}</p>
      </div>
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">USER ID</h4>
        <p>{form.userId}</p>
      </div>
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">SERVER ID</h4>
        <p>{form.game === 'freefire' ? '0' : form.serverId}</p>
      </div>
      {form.nickname && (
        <div className="border-b border-gray-200 pb-2">
          <h4 className="font-semibold">NICKNAME</h4>
          <p>{form.nickname}</p>
        </div>
      )}
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">PAYMENT</h4>
        <p>KHQR</p>
      </div>
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">PRICE</h4>
        <p>{finalAmount.toFixed(2)} USD</p>
      </div>
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold">TRANSACTION ID</h4>
        <p>{transactionId}</p>
      </div>
    </div>
    <div className="text-center text-sm text-gray-500 pt-2">
      <p>សូមថតវិក័យបត្រទុកដើម្បីផ្ទៀងផ្ទាត់</p>
    </div>
    <button
      onClick={onContinue}
      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
    >
      ទិញបន្តទៀត
    </button>
  </div>
);

// Main PaymentModal Component
export function PaymentModal({ form, orderFormat, onClose, discountPercent = 0 }: Props) {
  const config = getConfig();
  const paymentConfig = getPaymentConfig();

  const [status, setStatus] = useState<'pending' | 'success' | 'checking' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [md5Hash, setMd5Hash] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [lastQrGeneration, setLastQrGeneration] = useState(0);
  const qrTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { seconds: qrCooldown, start: startQrCooldown, stop: stopQrCooldown, intervalRef: cooldownIntervalRef } =
    useCountdown(QR_COOLDOWN_PERIOD);
  const { seconds: nextCheckTime, start: startCheckCountdown, stop: stopCheckCountdown, intervalRef: checkCountdownRef } =
    useCountdown(5);

  const productName = useMemo(
    () => (form.product?.diamonds ? `${form.product.diamonds} diamond` : form.product?.name || ''),
    [form.product]
  );

  const finalAmount = useMemo(() => {
    if (!form.product?.price) return 0;
    const discount = (form.product.price * discountPercent) / 100;
    return Math.round((form.product.price - discount) * 100) / 100;
  }, [form.product?.price, discountPercent]);

  const sendToTelegram = useCallback(async () => {
    try {
      const txId = `tb${Math.floor(100000 + Math.random() * 900000)}`;
      setTransactionId(txId);

      const { data: tokenResult, error: tokenError } = await supabase.rpc('create_payment_token', {
        order_info: {
          transactionId: txId,
          game: form.game,
          amount: finalAmount,
          item: form.product?.name,
          userId: form.userId,
          serverId: form.game === 'freefire' ? '0' : form.serverId,
          orderId: Date.now().toString(),
          orderDate: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),
          mainMessage: `${form.userId} ${form.game === 'freefire' ? '0' : form.serverId} ${
            form.product?.code || form.product?.diamonds || form.product?.name
          }`,
          orderMessage: `Top up successful✅\n\n` +
            `-Transaction: ${txId}\n` +
            `-Game: ${form.game === 'mlbb' ? 'Mobile Legends' : 'Free Fire'}\n` +
            `-Amount: ${finalAmount} $\n` +
            `-Item: ${form.product?.name}\n` +
            `-User ID: ${form.userId}\n` +
            `-Server ID: ${form.game === 'freefire' ? '0' : form.serverId}\n` +
            `-Order ID: S${Date.now()}\n` +
            `-Order Date: ${new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}`,
        },
      });

      if (tokenError || !tokenResult) throw new Error('Failed to generate payment token');

      const response = await axios.post('/api/telegram', {}, {
        headers: { Authorization: `Bearer ${tokenResult}` },
      });

      if (!response.data.success) throw new Error('Failed to send message to Telegram');
    } catch (error) {
      console.error('Telegram error:', error);
      setErrorMessage('Failed to send order confirmation. Please contact support.');
      setStatus('error');
    }
  }, [form, finalAmount]);

  const { verifyPayment, startVerification, cleanup, checkCount, autoCheckEnabled, isProcessing } =
    usePaymentVerification(md5Hash, sendToTelegram, setStatus);

  const generateKHQR = useCallback(async () => {
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
      if (finalAmount < 0.01) throw new Error('Amount must be at least 0.01 USD.');

      const response = await axios.post<KhqrResponse>('/api/khqr', {
        bakongAccountID: paymentConfig.khqr.accountId,
        accName: paymentConfig.khqr.accountName,
        accountInformation: paymentConfig.khqr.accountInformation,
        currency: paymentConfig.khqr.currency,
        amount: finalAmount,
        address: paymentConfig.khqr.address,
      });

      if (response.data.success && response.data.qrImage && response.data.md5) {
        setQrCode(response.data.qrImage);
        setMd5Hash(response.data.md5);
        setLastQrGeneration(now);
      } else {
        throw new Error('Invalid QR code response');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        axios.isAxiosError(error) ? error.response?.data?.message || 'Network error.' : (error as Error).message
      );
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, finalAmount, qrCode, qrCooldown, lastQrGeneration, paymentConfig.khqr]);

  useEffect(() => {
    generateKHQR();
  }, [generateKHQR]);

  useEffect(() => {
    if (md5Hash && !autoCheckEnabled) {
      startVerification();
      startCheckCountdown();
      qrTimeoutRef.current = setTimeout(() => {
        cleanup();
        setStatus('error');
        setErrorMessage('QR code has expired. Please try again.');
      }, QR_EXPIRY);
    }
    return () => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [md5Hash, autoCheckEnabled, startVerification, cleanup, startCheckCountdown]);

  useEffect(() => {
    return () => {
      cleanup();
      stopCheckCountdown();
      stopQrCooldown();
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [cleanup, stopCheckCountdown, stopQrCooldown]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div
        className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-4 max-w-md w-full relative shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto"
        style={{ backgroundImage: `url("${config.backgroundImageUrl}")`, backgroundSize: 'cover' }}
      >
        <div className="absolute inset-0 bg-black/50 rounded-2xl backdrop-blur-sm" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white/60 hover:text-white"
          aria-label="Close payment modal"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative z-10 space-y-3">
          {status === 'success' ? (
            <SuccessReceipt
              form={form}
              productName={productName}
              finalAmount={finalAmount}
              transactionId={transactionId}
              onContinue={onClose}
            />
          ) : (
            <div className="bg-white rounded-lg p-3 shadow-lg space-y-2">
              <div className="flex items-center gap-2">
                <img
                  src="https://play-lh.googleusercontent.com/ABNDYwddbqTFpqp809iNq3r9LjrE2qTZ8xFqWmc-iLfHe2vyPAPwZrN_4S1QCFaLDYE=w240-h480-rw"
                  alt="KHQR Logo"
                  className="w-8 h-8"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Scan with Bakong</h4>
                  <p className="text-xs text-gray-500">QR code expires in 5 minutes</p>
                </div>
              </div>
              {qrCode ? (
                <img src={qrCode} alt="KHQR Code" className="w-full max-w-[180px] mx-auto" loading="lazy" />
              ) : qrCooldown > 0 ? (
                <div className="text-center py-4">
                  <Timer className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-gray-600">Please wait {qrCooldown}s to generate a new QR code</p>
                </div>
              ) : (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              )}
              <p className="text-center text-sm font-medium text-gray-700">
                🔄 <span className="text-red-500">សូមត្រឡប់មកវិញបន្ទាប់ពីបង់ប្រាក់</span> 🔄
              </p>
              {autoCheckEnabled && (
                <div className="text-xs text-center text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    <Timer className="w-3 h-3 animate-pulse" />
                    <span>Next check in {nextCheckTime}s (Check #{checkCount})</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center justify-center gap-2 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
