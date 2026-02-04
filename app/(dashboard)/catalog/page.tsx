'use client';

import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart,
  Calendar,
  X,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Product } from '@/types';

export default function CatalogPage() {
  const { products, cart, addToCart, updateQuantity, removeFromCart, clearCart, setOrders } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Toppers'); // Changed default to Toppers
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [notification, setNotification] = useState('');

  // Fixed order: Toppers, Treats, All
  const categories = ['Toppers', 'Treats', 'All'];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const showNotificationMessage = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 2000);
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    showNotificationMessage('Added to cart');
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryDate: deliveryDate || null,
          promotionCode: promoCode || null
        }),
      });

      const data = await response.json();

      if (data.success) {
        try {
          const ordersResponse = await fetch('/api/orders');
          const ordersData = await ordersResponse.json();
          if (ordersData?.orders) {
            setOrders(ordersData.orders);
          }
        } catch (fetchError) {
          console.error('Failed to refresh orders:', fetchError);
        }
        setOrderSuccess(true);
        clearCart();
        setShowCheckout(false);
        setTimeout(() => {
          setOrderSuccess(false);
          setShowCart(false);
        }, 3000);
      } else {
        showNotificationMessage('Order failed: ' + data.error);
      }
    } catch (error) {
      showNotificationMessage('Order submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {notification && (
        <div className="fixed top-20 lg:top-6 right-6 z-50 bg-cream-100 border border-cream-200 rounded-xl p-4 shadow-lg animate-slide-up flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-bark-500 font-medium">{notification}</span>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 bg-bark-500/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cream-100 rounded-2xl p-8 max-w-md w-full text-center animate-slide-up">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-bark-500 mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
              Order Submitted!
            </h2>
            <p className="text-bark-500/70">
              Check your email for confirmation.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Product Catalog</h1>
          <p className="text-bark-500/70 mt-1">Browse and order our premium products</p>
        </div>
        
        <button
          onClick={() => setShowCart(true)}
          className="btn-primary relative"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          View Cart
          {cartItemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-bark-500 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-bark-500">
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setCategoryFilter(category)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  categoryFilter === category
                    ? 'bg-bark-500 text-white'
                    : 'bg-cream-200 text-bark-500 hover:bg-cream-300'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const cartItem = cart.find(item => item.id === product.id);
          return (
            <div key={product.id} className="card overflow-hidden">
              <div className="aspect-square bg-cream-200 p-4 flex items-center justify-center">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-cream-300 rounded-lg" />
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                      {product.name}
                    </h3>
                    <p className="text-sm text-bark-500/60">{product.size}</p>
                  </div>
                  <span className="bg-cream-200 text-bark-500 text-xs px-2 py-1 rounded-lg">{product.category}</span>
                </div>
                <p className="text-sm text-bark-500/70 mb-4 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                      {formatCurrency(product.price)}
                    </span>
                    <span className="text-xs text-bark-500/60 ml-1">/unit</span>
                  </div>
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center hover:bg-cream-300 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-bark-500" />
                      </button>
                      <span className="w-8 text-center font-semibold text-bark-500">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center hover:bg-cream-300 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-bark-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="btn-primary py-2 px-4 text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="card p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
          <p className="text-bark-500/70">No products found</p>
        </div>
      )}

      {showCart && (
        <>
          <div 
            className="fixed inset-0 bg-bark-500/20 backdrop-blur-sm z-40"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-cream-100 z-50 shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-cream-200 flex items-center justify-between sticky top-0 bg-cream-100 z-10">
              <h2 className="text-xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                Your Cart ({cartItemCount})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 rounded-lg hover:bg-cream-200 transition-colors"
              >
                <X className="w-5 h-5 text-bark-500" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-bark-500/30 mx-auto mb-4" />
                <p className="text-bark-500/70">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-cream-200 rounded-xl">
                      <div className="w-16 h-16 bg-cream-300 rounded-lg flex-shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <ShoppingCart className="w-6 h-6 text-bark-500/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-bark-500 truncate">{item.name}</h4>
                        <p className="text-sm text-bark-500/60">{item.size}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded bg-cream-100 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3 text-bark-500" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium text-bark-500">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded bg-cream-100 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3 text-bark-500" />
                            </button>
                          </div>
                          <span className="font-semibold text-bark-500">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-bark-500/40 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {showCheckout ? (
                  <div className="p-6 border-t border-cream-200 space-y-4">
                    <div>
                      <label className="label">Requested Delivery Date (Optional)</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                        <input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="input pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Promotion Code (Optional)</label>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter code"
                        className="input"
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-cream-200">
                      <div className="flex justify-between text-lg font-bold text-bark-500 mb-4">
                        <span>Total</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                      <button
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                        className="btn-primary w-full"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          'Submit Order'
                        )}
                      </button>
                      <button
                        onClick={() => setShowCheckout(false)}
                        className="btn-secondary w-full mt-2"
                      >
                        Back to Cart
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-t border-cream-200 sticky bottom-0 bg-cream-100">
                    <div className="flex justify-between text-lg font-bold text-bark-500 mb-4">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="btn-primary w-full"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
