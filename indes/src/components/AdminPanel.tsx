
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Trash, Edit, Save, X, LogOut, RefreshCw, Users, ShoppingBag, Settings, DollarSign, Tag, Image as ImageIcon, BarChart2 } from 'lucide-react';
import { ResellerManager } from './ResellerManager';
import { ResellerPriceManager } from './ResellerPriceManager';
import { PromoCodeManager } from './PromoCodeManager';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Interfaces
interface GameProduct {
  id: number;
  name: string;
  diamonds?: number | null;
  price: number;
  currency: string;
  type: 'diamonds' | 'subscription' | 'special';
  game: 'mlbb' | 'freefire';
  image?: string | null;
  code?: string | null;
}

interface TransactionMetric {
  year: number;
  month: number;
  day?: number;
  count: number;
}

interface AdminPanelProps {
  onLogout: () => void;
}

interface ProductFormProps {
  product: Partial<GameProduct> | GameProduct;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  formErrors: { [key: string]: string };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  isEditing: boolean;
  loading: boolean;
  activeTab: 'mlbb' | 'freefire';
}

// Reusable ProductForm Component
const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSubmit,
  onCancel,
  formErrors,
  onInputChange,
  isEditing,
  loading,
  activeTab
}) => (
  <div className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-medium text-gray-900">{isEditing ? 'Edit Product' : 'Add New Product'}</h3>
      <button onClick={onCancel} className="text-gray-500 hover:text-gray-700" aria-label="Close form">
        <X className="w-5 h-5" />
      </button>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}name`} className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <input
            type="text"
            id={`${isEditing ? 'edit-' : ''}name`}
            name="name"
            value={product.name || ''}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.name ? `${isEditing ? 'edit-' : ''}name-error` : undefined}
          />
          {formErrors.name && (
            <p id={`${isEditing ? 'edit-' : ''}name-error`} className="text-red-500 text-xs mt-1">{formErrors.name}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}type`} className="block text-sm font-medium text-gray-700 mb-1">
            Product Type
          </label>
          <select
            id={`${isEditing ? 'edit-' : ''}type`}
            name="type"
            value={product.type || 'diamonds'}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.type ? `${isEditing ? 'edit-' : ''}type-error` : undefined}
          >
            <option value="diamonds">Diamonds</option>
            <option value="subscription">Subscription</option>
            <option value="special">Special</option>
          </select>
          {formErrors.type && (
            <p id={`${isEditing ? 'edit-' : ''}type-error`} className="text-red-500 text-xs mt-1">{formErrors.type}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}diamonds`} className="block text-sm font-medium text-gray-700 mb-1">
            Diamonds Amount
          </label>
          <input
            type="number"
            id={`${isEditing ? 'edit-' : ''}diamonds`}
            name="diamonds"
            value={product.diamonds ?? ''}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.diamonds ? `${isEditing ? 'edit-' : ''}diamonds-error` : undefined}
          />
          {formErrors.diamonds && (
            <p id={`${isEditing ? 'edit-' : ''}diamonds-error`} className="text-red-500 text-xs mt-1">{formErrors.diamonds}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}price`} className="block text-sm font-medium text-gray-700 mb-1">
            Price
          </label>
          <input
            type="number"
            id={`${isEditing ? 'edit-' : ''}price`}
            name="price"
            step="0.01"
            value={product.price ?? ''}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.price ? `${isEditing ? 'edit-' : ''}price-error` : undefined}
          />
          {formErrors.price && (
            <p id={`${isEditing ? 'edit-' : ''}price-error`} className="text-red-500 text-xs mt-1">{formErrors.price}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}currency`} className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <input
            type="text"
            id={`${isEditing ? 'edit-' : ''}currency`}
            name="currency"
            value={product.currency || ''}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.currency ? `${isEditing ? 'edit-' : ''}currency-error` : undefined}
          />
          {formErrors.currency && (
            <p id={`${isEditing ? 'edit-' : ''}currency-error`} className="text-red-500 text-xs mt-1">{formErrors.currency}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${isEditing ? 'edit-' : ''}image`} className="block text-sm font-medium text-gray-700 mb-1">
            Image URL
          </label>
          <input
            type="text"
            id={`${isEditing ? 'edit-' : ''}image`}
            name="image"
            value={product.image ?? ''}
            onChange={onInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            aria-describedby={formErrors.image ? `${isEditing ? 'edit-' : ''}image-error` : undefined}
          />
          {formErrors.image && (
            <p id={`${isEditing ? 'edit-' : ''}image-error`} className="text-red-500 text-xs mt-1">{formErrors.image}</p>
          )}
        </div>
        {activeTab === 'mlbb' && (
          <div>
            <label htmlFor={`${isEditing ? 'edit-' : ''}code`} className="block text-sm font-medium text-gray-700 mb-1">
              Product Code (MLBB only)
            </label>
            <input
              type="text"
              id={`${isEditing ? 'edit-' : ''}code`}
              name="code"
              value={product.code ?? ''}
              onChange={onInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update Product' : 'Save Product'}
            </>
          )}
        </button>
      </div>
    </form>
  </div>
);

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <h1 className="text-center text-red-600 mt-10">Something went wrong. Please refresh the page.</h1>;
    }
    return this.props.children;
  }
}

export function AdminPanel({ onLogout }: AdminPanelProps) {
  const [mlbbProducts, setMlbbProducts] = useState<GameProduct[]>([]);
  const [ffProducts, setFfProducts] = useState<GameProduct[]>([]);
  const [logoBanner, setLogoBanner] = useState<string | null>(null);
  const [transactionsPerMonth, setTransactionsPerMonth] = useState<TransactionMetric[]>([]);
  const [transactionsPerDay, setTransactionsPerDay] = useState<TransactionMetric[]>([]);
  const [resellerCount, setResellerCount] = useState<number>(0);
  const [userCount, setUserCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mlbb' | 'freefire' | 'resellers' | 'prices' | 'promos' | 'settings' | 'dashboard'>('dashboard');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // New product form state
  const [newProduct, setNewProduct] = useState<Partial<GameProduct>>({
    name: '',
    diamonds: null,
    price: 0,
    currency: 'USD',
    type: 'diamonds',
    game: 'mlbb',
    image: '',
    code: ''
  });

  // Editing product state
  const [editingProduct, setEditingProduct] = useState<GameProduct | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: mlbbData, error: mlbbError },
        { data: ffData, error: ffError },
        { data: settingsData, error: settingsError },
        { data: monthlyTxData, error: monthlyTxError },
        { data: dailyTxData, error: dailyTxError },
        { count: resellerCountData, error: resellerCountError },
        { count: userCountData, error: userCountError }
      ] = await Promise.all([
        supabase.from('mlbb_products').select('*').order('id', { ascending: true }),
        supabase.from('freefire_products').select('*').order('id', { ascending: true }),
        supabase.from('settings').select('value').eq('key', 'logo_banner').single(),
        supabase.from('transactions').select('created_at').gte('created_at', '2024-01-01'),
        supabase.from('transactions').select('created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('resellers').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true })
      ]);

      if (mlbbError) throw new Error(`Failed to fetch MLBB products: ${mlbbError.message}`);
      if (ffError) throw new Error(`Failed to fetch Free Fire products: ${ffError.message}`);
      if (settingsError && settingsError.code !== 'PGRST116') throw new Error(`Failed to fetch settings: ${settingsError.message}`);
      if (monthlyTxError) throw new Error(`Failed to fetch monthly transactions: ${monthlyTxError.message}`);
      if (dailyTxError) throw new Error(`Failed to fetch daily transactions: ${dailyTxError.message}`);
      if (resellerCountError) throw new Error(`Failed to fetch reseller count: ${resellerCountError.message}`);
      if (userCountError) throw new Error(`Failed to fetch user count: ${userCountError.message}`);

      // Transform product data
      const transformedMlbbProducts: GameProduct[] = (mlbbData || []).map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game: 'mlbb',
        image: product.image,
        code: product.code
      }));

      const transformedFfProducts: GameProduct[] = (ffData || []).map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game: 'freefire',
        image: product.image
      }));

      // Transform transaction data
      const monthlyCounts: { [key: string]: number } = {};
      const dailyCounts: { [key: string]: number } = {};
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      (monthlyTxData || []).forEach(row => {
        const date = new Date(row.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const monthKey = `${year}-${month}`;
        const dayKey = `${year}-${month}-${day}`;
        monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
        if (date >= thirtyDaysAgo) {
          dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
        }
      });

      const transformedMonthlyTx: TransactionMetric[] = Object.entries(monthlyCounts)
        .map(([key, count]) => {
          const [year, month] = key.split('-').map(Number);
          return { year, month, count };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month);

      const transformedDailyTx: TransactionMetric[] = Object.entries(dailyCounts)
        .map(([key, count]) => {
          const [year, month, day] = key.split('-').map(Number);
          return { year, month, day, count };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month || (a.day! - b.day!));

      setMlbbProducts(transformedMlbbProducts);
      setFfProducts(transformedFfProducts);
      setLogoBanner(settingsData?.value || null);
      setTransactionsPerMonth(transformedMonthlyTx);
      setTransactionsPerDay(transformedDailyTx);
      setResellerCount(resellerCountData || 0);
      setUserCount(userCountData || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      toast.success('Data refreshed successfully!');
    } catch {
      toast.error('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Validate product form
  const validateForm = (product: Partial<GameProduct> | GameProduct): boolean => {
    const errors: { [key: string]: string } = {};

    if (!product.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (product.type === 'diamonds' && (product.diamonds === undefined || product.diamonds === null)) {
      errors.diamonds = 'Diamonds amount is required for diamond type products';
    }

    if (product.price === undefined || product.price <= 0) {
      errors.price = 'Price must be greater than 0';
    }

    if (!product.currency?.trim()) {
      errors.currency = 'Currency is required';
    }

    if (!product.type) {
      errors.type = 'Type is required';
    }

    if (!product.image?.trim()) {
      errors.image = 'Image URL is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    product: Partial<GameProduct> | GameProduct = newProduct
  ) => {
    const { name, value, type } = e.target;
    const isEditing = (p: Partial<GameProduct> | GameProduct): p is GameProduct => 'id' in p;
    const numValue = type === 'number' ? parseFloat(value) || null : value;

    const updatedProduct = {
      ...product,
      [name]: name === 'price' || name === 'diamonds' ? numValue : value
    };

    if (isEditing(product)) {
      setEditingProduct(updatedProduct as GameProduct);
    } else {
      setNewProduct(updatedProduct);
    }

    validateForm(updatedProduct);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(newProduct)) {
      return;
    }

    setLoading(true);
    try {
      const tableName = newProduct.game === 'mlbb' ? 'mlbb_products' : 'freefire_products';

      const productData = {
        name: newProduct.name,
        diamonds: newProduct.diamonds || null,
        price: newProduct.price,
        currency: newProduct.currency,
        type: newProduct.type,
        image: newProduct.image || null,
        ...(newProduct.game === 'mlbb' && { code: newProduct.code || null })
      };

      const { error } = await supabase.from(tableName).insert([productData]);

      if (error) throw new Error(`Failed to add product: ${error.message}`);

      setNewProduct({
        name: '',
        diamonds: null,
        price: 0,
        currency: 'USD',
        type: 'diamonds',
        game: newProduct.game,
        image: '',
        code: ''
      });

      setShowAddForm(false);
      await fetchData();

      toast.success('Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct || !validateForm(editingProduct)) {
      return;
    }

    setLoading(true);
    try {
      const tableName = editingProduct.game === 'mlbb' ? 'mlbb_products' : 'freefire_products';

      const productData = {
        name: editingProduct.name,
        diamonds: editingProduct.diamonds || null,
        price: editingProduct.price,
        currency: editingProduct.currency,
        type: editingProduct.type,
        image: editingProduct.image || null,
        updated_at: new Date().toISOString(),
        ...(editingProduct.game === 'mlbb' && { code: editingProduct.code || null })
      };

      const { error } = await supabase
        .from(tableName)
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) throw new Error(`Failed to update product: ${error.message}`);

      setEditingProduct(null);
      setShowEditForm(false);
      await fetchData();

      toast.success('Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (product: GameProduct) => {
    if (!confirm(`Are you sure you want to delete ${product.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const tableName = product.game === 'mlbb' ? 'mlbb_products' : 'freefire_products';

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', product.id);

      if (error) throw new Error(`Failed to delete product: ${error.message}`);

      await fetchData();

      toast.success('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/gif'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PNG, JPEG, or GIF image.');
        return;
      }
      if (file.size > maxSize) {
        toast.error('File size must be less than 5MB.');
        return;
      }
      setBannerFile(file);
    }
  };

  const handleUploadBanner = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bannerFile) {
      toast.error('Please select an image file.');
      return;
    }

    setUploadingBanner(true);
    try {
      const fileExt = bannerFile.name.split('.').pop();
      const fileName = `logo_banner_${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, bannerFile);

      if (uploadError) throw new Error(`Failed to upload banner: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ key: 'logo_banner', value: urlData.publicUrl }, { onConflict: 'key' });

      if (settingsError) throw new Error(`Failed to update settings: ${settingsError.message}`);

      setLogoBanner(urlData.publicUrl);
      setBannerFile(null);
      toast.success('Logo banner updated successfully!');
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload banner. Please try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const startEditProduct = (product: GameProduct) => {
    setEditingProduct(product);
    setShowEditForm(true);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setShowEditForm(false);
    setFormErrors({});
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setFormErrors({});
    setNewProduct({
      name: '',
      diamonds: null,
      price: 0,
      currency: 'USD',
      type: 'diamonds',
      game: activeTab === 'resellers' || activeTab === 'prices' || activeTab === 'promos' || activeTab === 'settings' || activeTab === 'dashboard' ? 'mlbb' : activeTab,
      image: '',
      code: ''
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick draggable pauseOnHover />
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              {logoBanner ? (
                <img
                  src={logoBanner}
                  alt="Logo Banner"
                  className="h-12 w-auto mr-4 object-contain"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
              )}
              <span className="ml-4 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Logged In
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Refresh data"
              >
                {refreshing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                <span className="text-sm">Refresh</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 text-red-600 hover:text-red-800 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                >
                  <BarChart2 className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setActiveTab('mlbb');
                    setNewProduct(prev => ({ ...prev, game: 'mlbb' }));
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'mlbb'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'mlbb' ? 'page' : undefined}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Mobile Legends
                </button>
                <button
                  onClick={() => {
                    setActiveTab('freefire');
                    setNewProduct(prev => ({ ...prev, game: 'freefire' }));
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'freefire'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'freefire' ? 'page' : undefined}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Free Fire
                </button>
                <button
                  onClick={() => {
                    setActiveTab('resellers');
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'resellers'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'resellers' ? 'page' : undefined}
                >
                  <Users className="w-4 h-4" />
                  Resellers
                </button>
                <button
                  onClick={() => {
                    setActiveTab('prices');
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'prices'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'prices' ? 'page' : undefined}
                >
                  <DollarSign className="w-4 h-4" />
                  Reseller Prices
                </button>
                <button
                  onClick={() => {
                    setActiveTab('promos');
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'promos'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'promos' ? 'page' : undefined}
                >
                  <Tag className="w-4 h-4" />
                  Promo Codes
                </button>
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowAddForm(false);
                    setShowEditForm(false);
                  }}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'dashboard' ? (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">Total Resellers</h3>
                      <p className="text-2xl font-bold text-blue-600">{resellerCount}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
                      <p className="text-2xl font-bold text-blue-600">{userCount}</p>
                    </div>
                  </div>

                  {/* Transactions Per Month Chart */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions Per Month</h3>
                    {transactionsPerMonth.length > 0 ? (
                      <div className="h-64">
                        <Line
                          data={{
                            labels: transactionsPerMonth.map(tx => `${tx.year}-${tx.month.toString().padStart(2, '0')}`),
                            datasets: [{
                              label: 'Transactions Per Month',
                              data: transactionsPerMonth.map(tx => tx.count),
                              borderColor: '#2563eb',
                              backgroundColor: 'rgba(37, 99, 235, 0.2)',
                              fill: true,
                              tension: 0.4
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: { title: { display: true, text: 'Month' } },
                              y: { title: { display: true, text: 'Transaction Count' }, beginAtZero: true }
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-center text-sm text-gray-500">No transaction data available.</p>
                    )}
                  </div>

                  {/* Transactions Per Month Table */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions Per Month (Table)</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Count</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {transactionsPerMonth.length > 0 ? (
                            transactionsPerMonth.map((tx, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.year}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.month}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                                No transaction data available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transactions Per Day (Last 30 Days) */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions Per Day (Last 30 Days)</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Count</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {transactionsPerDay.length > 0 ? (
                            transactionsPerDay.map((tx, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {`${tx.year}-${tx.month.toString().padStart(2, '0')}-${tx.day!.toString().padStart(2, '0')}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                                No transaction data available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'resellers' ? (
                <ResellerManager />
              ) : activeTab === 'prices' ? (
                <ResellerPriceManager mlbbProducts={mlbbProducts} ffProducts={ffProducts} />
              ) : activeTab === 'promos' ? (
                <PromoCodeManager />
              ) : activeTab === 'settings' ? (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Logo Banner</h3>
                    {logoBanner && (
                      <div className="mb-4">
                        <img
                          src={logoBanner}
                          alt="Current Logo Banner"
                          className="h-24 w-auto object-contain rounded-md"
                        />
                      </div>
                    )}
                    <form onSubmit={handleUploadBanner} className="space-y-4">
                      <div>
                        <label htmlFor="banner" className="block text-sm font-medium text-gray-700 mb-1">
                          Upload New Logo Banner
                        </label>
                        <input
                          type="file"
                          id="banner"
                          accept="image/*"
                          onChange={handleBannerFileChange}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={uploadingBanner || !bannerFile}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {uploadingBanner ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4" />
                              Upload Banner
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {activeTab === 'mlbb' ? 'Mobile Legends Products' : 'Free Fire Products'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowAddForm(true);
                        setShowEditForm(false);
                        setNewProduct(prev => ({ ...prev, game: activeTab }));
                      }}
                      className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Product
                    </button>
                  </div>

                  {loading && !showAddForm && !showEditForm ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-600">Loading products...</span>
                    </div>
                  ) : (
                    <>
                      {showAddForm && (
                        <ProductForm
                          product={newProduct}
                          onSubmit={handleAddProduct}
                          onCancel={cancelAdd}
                          formErrors={formErrors}
                          onInputChange={e => handleInputChange(e)}
                          isEditing={false}
                          loading={loading}
                          activeTab={activeTab as 'mlbb' | 'freefire'}
                        />
                      )}

                      {showEditForm && editingProduct && (
                        <ProductForm
                          product={editingProduct}
                          onSubmit={handleEditProduct}
                          onCancel={cancelEdit}
                          formErrors={formErrors}
                          onInputChange={e => handleInputChange(e, editingProduct)}
                          isEditing={true}
                          loading={loading}
                          activeTab={activeTab as 'mlbb' | 'freefire'}
                        />
                      )}

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ID
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Product
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Diamonds
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price
                              </th>
                              {activeTab === 'mlbb' && (
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Code
                                </th>
                              )}
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(activeTab === 'mlbb' ? mlbbProducts : ffProducts).map((product) => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {product.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {product.image && (
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-10 h-10 rounded-md mr-3 object-cover"
                                      />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      product.type === 'diamonds'
                                        ? 'bg-blue-100 text-blue-800'
                                        : product.type === 'subscription'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {product.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {product.diamonds ?? '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {product.currency} {product.price.toFixed(2)}
                                </td>
                                {activeTab === 'mlbb' && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.code || '-'}
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => startEditProduct(product)}
                                      className="text-blue-600 hover:text-blue-900"
                                      aria-label={`Edit ${product.name}`}
                                    >
                                      <Edit className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(product)}
                                      className="text-red-600 hover:text-red-900"
                                      aria-label={`Delete ${product.name}`}
                                    >
                                      <Trash className="w-5 h-5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {(activeTab === 'mlbb' ? mlbbProducts.length === 0 : ffProducts.length === 0) && !loading && (
                              <tr>
                                <td colSpan={activeTab === 'mlbb' ? 7 : 6} className="px-6 py-4 text-center text-sm text-gray-500">
                                  No products found. Add some products to get started.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

