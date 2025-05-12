
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GameProduct, Reseller, ResellerPrice } from '../types';
import { Loader2, Plus, Trash, Edit, Save, X, LogOut, RefreshCw, Users, ShoppingBag, Settings, DollarSign, Tag, Image as ImageIcon, BarChart2 } from 'lucide-react';
import { ResellerManager } from './ResellerManager';
import { ResellerPriceManager } from './ResellerPriceManager';
import { PromoCodeManager } from './PromoCodeManager';

// Interface for transaction metrics
interface TransactionMetric {
  year: number;
  month: number;
  day?: number;
  count: number;
}

interface AdminPanelProps {
  onLogout: () => void;
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
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  
  // New product form state
  const [newProduct, setNewProduct] = useState<Partial<GameProduct>>({
    name: '',
    diamonds: undefined,
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
      // Fetch MLBB products
      const { data: mlbbData, error: mlbbError } = await supabase
        .from('mlbb_products')
        .select('*')
        .order('id', { ascending: true });
      if (mlbbError) throw mlbbError;

      // Fetch Free Fire products
      const { data: ffData, error: ffError } = await supabase
        .from('freefire_products')
        .select('*')
        .order('id', { ascending: true });
      if (ffError) throw ffError;

      // Fetch logo banner
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'logo_banner')
        .single();
      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

      // Fetch transactions per month
      const { data: monthlyTxData, error: monthlyTxError } = await supabase
        .from('transactions')
        .select('created_at')
        .gte('created_at', '2024-01-01');
      if (monthlyTxError) throw monthlyTxError;

      // Fetch transactions per day (last 30 days)
      const { data: dailyTxData, error: dailyTxError } = await supabase
        .from('transactions')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (dailyTxError) throw dailyTxError;

      // Fetch reseller count
      const { count: resellerCountData, error: resellerCountError } = await supabase
        .from('resellers')
        .select('*', { count: 'exact', head: true });
      if (resellerCountError) throw resellerCountError;
      // Fetch user count
      const { count: userCountData, error: userCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      if (userCountError) throw userCountError;

      // Transform product data
      const transformedMlbbProducts: GameProduct[] = mlbbData.map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds  undefined,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game: 'mlbb',
        image: product.image  undefined,
        code: product.code  undefined
      }));

      const transformedFfProducts: GameProduct[] = ffData.map(product => ({
        id: product.id,
        name: product.name,
        diamonds: product.diamonds  undefined,
        price: product.price,
        currency: product.currency,
        type: product.type as 'diamonds' | 'subscription' | 'special',
        game: 'freefire',
        image: product.image  undefined
      }));

      // Transform transaction data
      const monthlyCounts: { [key: string]: number } = {};
      monthlyTxData.forEach(row => {
        const date = new Date(row.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JavaScript months are 0-based
        const key = `${year}-${month}`;
        monthlyCounts[key] = (monthlyCounts[key]  0) + 1;
      });

      const transformedMonthlyTx: TransactionMetric[] = Object.entries(monthlyCounts).map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      }).sort((a, b) => a.year - b.year  a.month - b.month);

      const dailyCounts: { [key: string]: number } = {};
      dailyTxData.forEach(row => {
        const date = new Date(row.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const key = `${year}-${month}-${day}`;
        dailyCounts[key] = (dailyCounts[key]  0) + 1;
      });

      const transformedDailyTx: TransactionMetric[] = Object.entries(dailyCounts).map(([key, count]) => {
        const [year, month, day] = key.split('-').map(Number);
        return { year, month, day, count };
      }).sort((a, b) => a.year - b.year  a.month - b.month  (a.day! - b.day!));

      setMlbbProducts(transformedMlbbProducts);
      setFfProducts(transformedFfProducts);
      setLogoBanner(settingsData?.value  null);
      setTransactionsPerMonth(transformedMonthlyTx);
      setTransactionsPerDay(transformedDailyTx);
      setResellerCount(resellerCountData  0);
      setUserCount(userCountData  0);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Validate product form
  const validateForm = (product: Partial<GameProduct>): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!product.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (product.type === 'diamonds' && !product.diamonds) {
      errors.diamonds = 'Diamonds amount is required for diamond type products';
    }
    
    if (product.price === undefined  product.price <= 0) {
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    product: Partial<GameProduct> = newProduct
  ) => {
    const { name, value, type } = e.target;
    
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
    
    if (name === 'price'  name === 'diamonds') {
      const numValue = type === 'number' ? parseFloat(value) : null;
      
      if (product === newProduct) {
        setNewProduct(prev => ({
          ...prev,
          [name]: numValue !== null ? numValue : value
        }));
      } else if (editingProduct) {
        setEditingProduct(prev => ({
          ...prev!,
          [name]: numValue !== null ? numValue : value
        }));
      }
    } else {
      if (product === newProduct) {
        setNewProduct(prev => ({
          ...prev,
          [name]: value
        }));
      } else if (editingProduct) {
        setEditingProduct(prev => ({
          ...prev!,
          [name]: value
        }));
      }
    }
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
        diamonds: newProduct.diamonds  null,
        price: newProduct.price,
        currency: newProduct.currency,
        type: newProduct.type,
        image: newProduct.image  null,
        ...(newProduct.game === 'mlbb' && { code: newProduct.code  null })
      };
      
      const { error } = await supabase
        .from(tableName)
        .insert([productData]);
      
      if (error) throw error;
      
      setNewProduct({
        name: '',
        diamonds: undefined,
        price: 0,
        currency: 'USD',
        type: 'diamonds',
        game: newProduct.game,
        image: '',
        code: ''
      });
      
      setShowAddForm(false);
      await fetchData();
      
      alert('Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct  !validateForm(editingProduct)) {
      return;
    }
    
    setLoading(true);
    try {
      const tableName = editingProduct.game === 'mlbb' ? 'mlbb_products' : 'freefire_products';
      
      const productData = {
        name: editingProduct.name,
        diamonds: editingProduct.diamonds  null,
        price: editingProduct.price,
        currency: editingProduct.currency,
        type: editingProduct.type,
        image: editingProduct.image  null,
        updated_at: new Date().toISOString(),
        ...(editingProduct.game === 'mlbb' && { code: editingProduct.code  null })
      };
      
      const { error } = await supabase
        .from(tableName)
        .update(productData)
        .eq('id', editingProduct.id);
      
      if (error) throw new Error(Failed to update product: ${error.message});
      
      setEditingProduct(null);
      setShowEditForm(false);
      await fetchData();
      
      alert('Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      alert(error instanceof Error ? error.message : 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };
const handleDeleteProduct = async (product: GameProduct) => {
    if (!confirm(Are you sure you want to delete ${product.name}?)) {
      return;
    }
    
    setLoading(true);
    try {
      const tableName = product.game === 'mlbb' ? 'mlbb_products' : 'freefire_products';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', product.id);
      
      if (error) throw error;
      
      await fetchData();
      
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle banner file selection
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
    }
  };

  // Handle banner upload
  const handleUploadBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bannerFile) {
      alert('Please select an image file.');
      return;
    }
    
    setUploadingBanner(true);
    try {
      const fileExt = bannerFile.name.split('.').pop();
      const fileName = logo_banner_${Date.now()}.${fileExt};
      const filePath = branding/${fileName};
      
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, bannerFile);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);
      
      if (!urlData?.publicUrl) throw new Error('Failed to get public URL');
      
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ key: 'logo_banner', value: urlData.publicUrl }, { onConflict: 'key' });
      
      if (settingsError) throw settingsError;
      
      setLogoBanner(urlData.publicUrl);
      setBannerFile(null);
      alert('Logo banner updated successfully!');
    } catch (error) {
      console.error('Error uploading banner:', error);
      alert('Failed to upload banner. Please try again.');
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
      diamonds: undefined,
      price: 0,
      currency: 'USD',
      type: 'diamonds',
      game: activeTab === 'resellers'  activeTab === 'prices'  activeTab === 'promos'  activeTab === 'settings'  activeTab === 'dashboard' ? 'mlbb' : activeTab,
      image: '',
      code: ''
    });
  };
return (
    <div className="min-h-screen bg-gray-100">
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
                    : 'border-transparent text-gray-500 Hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Free Fire
              </button>
              <button
                onClick={() => {
                  setActiveTab('resellers');
                  setShowAddForm(false);
                  setShowEditForm(false);
                }}className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'resellers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
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
                </div>{/* Transactions Per Month */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions Per Month</h3>
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
              <ResellerPriceManager mlbbProducts={mlbbProducts}
                ffProducts={ffProducts}
              />
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
                        disabled={uploadingBanner  !bannerFile}
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
                      <div className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900">Add New Product</h3>
                          <button onClick={cancelAdd}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <form onSubmit={handleAddProduct} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Product Name
                              </label>
                              <input
                                type="text"
                                id="name"
                                name="name"
                                value={newProduct.name}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.name && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                                Product Type
                              </label>
                              <select
                                id="type"
                                name="type"
                                value={newProduct.type}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              >
                                <option value="diamonds">Diamonds</option>
                                <option value="subscription">Subscription</option>
                                <option value="special">Special</option>
                              </select>
                              {formErrors.type && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.type}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="diamonds" className="block text-sm font-medium text-gray-700 mb-1">
                                Diamonds Amount
                              </label>
                              <input
                                type="number"
                                id="diamonds"
                                name="diamonds"
                                value={newProduct.diamonds  ''}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.diamonds && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.diamonds}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                                Price
                              </label>
                              <input
                                type="number"
                                id="price"
                                name="price"
                                step="0.01"
                                value={newProduct.price  ''}
                                onChange={(e) => handleInputChange(e)}className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.price && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                                Currency
                              </label>
                              <input
                                type="text"
                                id="currency"
                                name="currency"
                                value={newProduct.currency}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.currency && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.currency}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                                Image URL
                              </label>
                              <input
                                type="text"
                                id="image"
                                name="image"
                                value={newProduct.image  ''}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.image && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.image}</p>
                              )}
                            </div>
                            {activeTab === 'mlbb' && (
                              <div>
                                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                                  Product Code (MLBB only)
                                </label>
                                <input
                                  type="text"
                                  id="code"
                                  name="code"
                                  value={newProduct.code  ''}
                                  onChange={(e) => handleInputChange(e)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelAdd}
                              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={loading}className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Save Product
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {showEditForm && editingProduct && (
                      <div className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900">Edit Product</h3>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <form onSubmit={handleEditProduct} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                                Product Name
                              </label>
                              <input
                                type="text"
                                id="edit-name"
                                name="name"
                                value={editingProduct.name}
                                onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.name && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="edit-type" className="block text-sm font-medium text-gray-700 mb-1">
                                Product Type
                              </label>
                              <select
                                id="edit-type"
                                name="type"
                                value={editingProduct.type}
                           onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              >
                                <option value="diamonds">Diamonds</option>
                                <option value="subscription">Subscription</option>
                                <option value="special">Special</option>
                              </select>
                              {formErrors.type && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.type}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="edit-diamonds" className="block text-sm font-medium text-gray-700 mb-1">
                                Diamonds Amount
                              </label>
                              <input
                                type="number"
                                id="edit-diamonds"
                                name="diamonds"
                                value={editingProduct.diamonds  ''}
                                onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.diamonds && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.diamonds}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-1">
                                Price
                              </label>
                              <input
                                type="number"
                                id="edit-price"
                                name="price"
                                step="0.01"
                                value={editingProduct.price  ''}
                                onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.price && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="edit-currency" className="block text-sm font-medium text-gray-700 mb-1">
                                Currency
                              </label>
                              <input
                                type="text"
                                id="edit-currency"
                                name="currency"
                                value={editingProduct.currency}
                                onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.currency && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.currency}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="edit-image" className="block text-sm font-medium text-gray-700 mb-1">
                                Image URL
                              </label>
                              <input type="text"
                                id="edit-image"
                                name="image"
                                value={editingProduct.image  ''}
                                onChange={(e) => handleInputChange(e, editingProduct)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                              {formErrors.image && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.image}</p>
                              )}
                            </div>
                            {editingProduct.game === 'mlbb' && (
                              <div>
                                <label htmlFor="edit-code" className="block text-sm font-medium text-gray-700 mb-1">
                                  Product Code (MLBB only)
                                </label>
                                <input
                                  type="text"
                                  id="edit-code"
                                  name="code"
                                  value={editingProduct.code  ''}
                                  onChange={(e) => handleInputChange(e, editingProduct)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
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
                                  Update Product
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}<div className="overflow-x-auto">
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
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.type === 'diamonds'
                                    ? 'bg-blue-100 text-blue-800'
                                    : product.type === 'subscription'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {product.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {product.diamonds  '-'}
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
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product)}
                                    className="text-red-600 hover:text-red-900"
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
  );
}
