'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Search, Plus, Edit2, Trash2, Package, X, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface Product { id: string; name: string; size: string; price: number; category: string; description: string; image_url: string; stock_quantity: number; is_active: boolean; created_at: string }

const emptyProduct = { name: '', size: '', price: 0, category: 'Toppers', description: '', image_url: '', stock_quantity: 100, is_active: true };

export default function AdminProductsPage() {
  const supabase = createClientComponentClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { filterProducts(); }, [products, searchQuery]);

  const fetchProducts = async () => { try { const { data } = await supabase.from('products').select('*').order('name'); setProducts(data || []); } catch (e) { console.error(e); } finally { setIsLoading(false); } };
  const filterProducts = () => { let f = [...products]; if (searchQuery) { const q = searchQuery.toLowerCase(); f = f.filter(p => p.name.toLowerCase().includes(q) || p.size.toLowerCase().includes(q)); } setFilteredProducts(f); };

  const toppers = filteredProducts.filter((product) => product.category === 'Toppers');
  const treats = filteredProducts.filter((product) => product.category === 'Treats');
  const otherProducts = filteredProducts.filter((product) => product.category !== 'Toppers' && product.category !== 'Treats');
  const showNotificationMessage = (msg: string, type: 'success' | 'error') => { setNotification({ message: msg, type }); setTimeout(() => setNotification({ message: '', type: '' }), 3000); };
  const handleAddProduct = () => { setIsEditing(false); setSelectedProduct(null); setFormData(emptyProduct); setShowModal(true); };
  const handleEditProduct = (p: Product) => { setIsEditing(true); setSelectedProduct(p); setFormData({ name: p.name, size: p.size, price: p.price, category: p.category, description: p.description || '', image_url: p.image_url || '', stock_quantity: p.stock_quantity || 100, is_active: p.is_active !== false }); setShowModal(true); };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);
    try { const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id); if (error) throw error; showNotificationMessage('Product deleted!', 'success'); setShowDeleteConfirm(false); setSelectedProduct(null); fetchProducts(); }
    catch (e) { console.error(e); showNotificationMessage('Failed to delete', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.size || !formData.price) { showNotificationMessage('Please fill required fields', 'error'); return; }
    setIsSubmitting(true);
    try {
      if (isEditing && selectedProduct) { const { error } = await supabase.from('products').update({ name: formData.name, size: formData.size, price: formData.price, category: formData.category, description: formData.description, image_url: formData.image_url, stock_quantity: formData.stock_quantity, is_active: formData.is_active }).eq('id', selectedProduct.id); if (error) throw error; showNotificationMessage('Product updated!', 'success'); }
      else { const { error } = await supabase.from('products').insert({ name: formData.name, size: formData.size, price: formData.price, category: formData.category, description: formData.description, image_url: formData.image_url, stock_quantity: formData.stock_quantity, is_active: formData.is_active }); if (error) throw error; showNotificationMessage('Product created!', 'success'); }
      setShowModal(false); setSelectedProduct(null); fetchProducts();
    } catch (e) { console.error(e); showNotificationMessage('Failed to save', 'error'); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;

  return (
    <div className="space-y-6">
      {notification.message && <div className={cn("fixed top-20 right-6 z-50 border rounded-xl p-4 shadow-lg flex items-center gap-3", notification.type === 'success' ? "bg-white border-gray-200" : "bg-red-50 border-red-200")}>{notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}<span className={notification.type === 'success' ? 'text-gray-900' : 'text-red-900'}>{notification.message}</span></div>}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
          <div className="flex gap-2">
            <button onClick={handleAddProduct} className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600"><Plus className="w-4 h-4" />Add Product</button>
          </div>
        </div>
      </div>

      {toppers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Toppers</h2>
            <span className="text-xs text-gray-500">{toppers.length} items</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {toppers.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="aspect-square bg-gray-100 p-4 flex items-center justify-center">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" /> : <Package className="w-16 h-16 text-gray-300" />}</div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2"><div><h3 className="font-semibold text-gray-900">{product.name}</h3><p className="text-sm text-gray-500">{product.size}</p></div><span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{product.category}</span></div>
                  <p className="text-lg font-bold text-gray-900 mb-2">{formatCurrency(product.price)}</p>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Stock: <span className={product.stock_quantity < 20 ? 'text-red-600 font-medium' : ''}>{product.stock_quantity ?? 'N/A'}</span></span><div className="flex gap-1"><button onClick={() => handleEditProduct(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button><button onClick={() => { setSelectedProduct(product); setShowDeleteConfirm(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {treats.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Treats</h2>
            <span className="text-xs text-gray-500">{treats.length} items</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {treats.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="aspect-square bg-gray-100 p-4 flex items-center justify-center">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" /> : <Package className="w-16 h-16 text-gray-300" />}</div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2"><div><h3 className="font-semibold text-gray-900">{product.name}</h3><p className="text-sm text-gray-500">{product.size}</p></div><span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{product.category}</span></div>
                  <p className="text-lg font-bold text-gray-900 mb-2">{formatCurrency(product.price)}</p>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Stock: <span className={product.stock_quantity < 20 ? 'text-red-600 font-medium' : ''}>{product.stock_quantity ?? 'N/A'}</span></span><div className="flex gap-1"><button onClick={() => handleEditProduct(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button><button onClick={() => { setSelectedProduct(product); setShowDeleteConfirm(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {otherProducts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Other</h2>
            <span className="text-xs text-gray-500">{otherProducts.length} items</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {otherProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="aspect-square bg-gray-100 p-4 flex items-center justify-center">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" /> : <Package className="w-16 h-16 text-gray-300" />}</div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2"><div><h3 className="font-semibold text-gray-900">{product.name}</h3><p className="text-sm text-gray-500">{product.size}</p></div><span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{product.category}</span></div>
                  <p className="text-lg font-bold text-gray-900 mb-2">{formatCurrency(product.price)}</p>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Stock: <span className={product.stock_quantity < 20 ? 'text-red-600 font-medium' : ''}>{product.stock_quantity ?? 'N/A'}</span></span><div className="flex gap-1"><button onClick={() => handleEditProduct(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button><button onClick={() => { setSelectedProduct(product); setShowDeleteConfirm(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(toppers.length + treats.length + otherProducts.length) === 0 && (
        <div className="col-span-full bg-white rounded-xl p-12 text-center border border-gray-100">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">{isEditing ? 'Edit Product' : 'Add New Product'}</h3><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Size *</label><input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Price *</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"><option value="Toppers">Toppers</option><option value="Treats">Treats</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label><input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label><input type="text" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500" /></div>
                <div className="col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500" /><span className="text-sm text-gray-700">Active (visible in catalog)</span></label></div>
              </div>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center">{isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEditing ? 'Update Product' : 'Add Product'}</button></div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Product</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete "{selectedProduct.name}"?</p>
            <div className="flex gap-3"><button onClick={() => { setShowDeleteConfirm(false); setSelectedProduct(null); }} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleDeleteProduct} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center">{isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Delete'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
