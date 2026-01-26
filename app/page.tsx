'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ShoppingCart, User, LogOut, Package, Calendar, CreditCard, Clock, Search, Plus, Minus, Trash2, CheckCircle, TrendingUp, Box, DollarSign, TrendingDown } from 'lucide-react';

export default function WholesalePortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('login');
  const [showSignup, setShowSignup] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  const supabase = createClientComponentClient();
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || '';

  useEffect(() => {
    checkUser();
    loadProducts();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserData();
      loadOrders();
    }
  }, [isLoggedIn]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setProducts(data);
  };

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('retailers')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) setUserData({ ...data, email: user.email });
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*, product_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const formattedOrders = data.map(order => ({
        id: order.order_number,
        date: new Date(order.created_at).toLocaleDateString(),
        status: order.status === 'pending' ? 'Processing' : 'Delivered',
        total: parseFloat(order.total),
        items: order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        orderItems: order.order_items
      }));
      setOrders(formattedOrders);
    }
  };

  const handleSignup = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
          businessName: formData.get('businessName'),
          businessAddress: formData.get('businessAddress'),
          phone: formData.get('phone')
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotificationPopup('Account created! Please check your email.');
        setShowSignup(false);
      } else {
        showNotificationPopup('Signup failed: ' + data.error);
      }
    } catch (error) {
      showNotificationPopup('Signup failed. Please try again.');
    }
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showNotificationPopup('Login failed: ' + error.message);
    } else {
      setIsLoggedIn(true);
      setCurrentView('catalog');
      showNotificationPopup('Welcome back!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setCurrentView('login');
    setCart([]);
    setUserData(null);
  };

  const submitOrder = async (deliveryDate: string) => {
    try {
      const promoCode = (document.getElementById('promotionCode') as HTMLInputElement)?.value || null;
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryDate: deliveryDate || null,
          promotionCode: promoCode
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotificationPopup('Order submitted! Check your email for confirmation.');
        setCart([]);
        setCurrentView('orders');
        loadOrders();
      } else {
        showNotificationPopup('Order failed: ' + data.error);
      }
    } catch (error) {
      showNotificationPopup('Order submission failed');
      console.error(error);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    showNotificationPopup('Added to cart');
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
    showNotificationPopup('Item removed');
  };

  const showNotificationPopup = (message: string) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate order analytics
  const calculateAnalytics = () => {
    let totalWholesale = 0;
    let totalMSRP = 0;

    orders.forEach(order => {
      totalWholesale += order.total;
      
      // Calculate MSRP for this order
      order.orderItems?.forEach((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.msrp) {
          totalMSRP += parseFloat(product.msrp) * item.quantity;
        }
      });
    });

    const potentialProfit = totalMSRP - totalWholesale;
    const profitMargin = totalWholesale > 0 ? ((potentialProfit / totalMSRP) * 100) : 0;

    return { totalWholesale, totalMSRP, potentialProfit, profitMargin };
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#EFE6CB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#3F1D0B' }}>Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#EFE6CB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; }
          .poppins { font-family: 'Poppins', sans-serif; }
        `}</style>

        <div style={{ maxWidth: '448px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 className="poppins" style={{ fontSize: '48px', fontWeight: '700', marginBottom: '8px', color: '#3F1D0B', letterSpacing: '-0.02em' }}>
              Bare Naked Pet Co.
            </h1>
            <p style={{ fontSize: '18px', color: '#3F1D0B', fontWeight: '500' }}>
              Wholesale Portal
            </p>
          </div>

          <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '32px', border: '1px solid #EFE6CB' }}>
            {!showSignup ? (
              <>
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="retailer@store.com"
                    />
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    style={{ width: '100%', backgroundColor: '#3F1D0B', color: 'white', fontWeight: '600', padding: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                  >
                    Sign In
                  </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <a href="#" style={{ fontSize: '14px', color: '#3F1D0B', textDecoration: 'none' }}>
                    Forgot password?
                  </a>
                </div>

                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #EFE6CB', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#3F1D0B', marginBottom: '12px' }}>
                    New retailer?
                  </p>
                  <button
                    onClick={() => setShowSignup(true)}
                    style={{ width: '100%', backgroundColor: 'white', color: '#3F1D0B', border: '2px solid #3F1D0B', fontWeight: '600', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                  >
                    Create Account
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="poppins" style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#3F1D0B', textAlign: 'center' }}>
                  Create Wholesale Account
                </h2>
                <form onSubmit={handleSignup}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Business Name
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="Pet Paradise Boutique"
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="orders@petparadise.com"
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="••••••••"
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Business Address
                    </label>
                    <input
                      type="text"
                      name="businessAddress"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <button
                    type="submit"
                    style={{ width: '100%', backgroundColor: '#3F1D0B', color: 'white', fontWeight: '600', padding: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '16px', marginBottom: '12px' }}
                  >
                    Create Account
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSignup(false)}
                    style={{ width: '100%', backgroundColor: 'white', color: '#3F1D0B', border: '2px solid #3F1D0B', fontWeight: '600', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                  >
                    Back to Sign In
                  </button>
                </form>
              </>
            )}
          </div>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: '#3F1D0B' }}>
            <p>Free shipping • No minimums</p>
          </div>
        </div>
      </div>
    );
  }

  const analytics = calculateAnalytics();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#EFE6CB' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; }
        .poppins { font-family: 'Poppins', sans-serif; }
      `}</style>

      {showNotification && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000, backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '16px 24px', border: '1px solid #EFE6CB', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={20} color="#16a34a" />
          <span style={{ fontWeight: '500', color: '#3F1D0B' }}>{notificationMessage}</span>
        </div>
      )}

      <header style={{ backgroundColor: '#F7F1E0', borderBottom: '1px solid #EFE6CB', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {logoUrl && (
              <img src={logoUrl} alt="Bare Naked Pet Co" style={{ height: '48px', width: 'auto' }} />
            )}
            <div>
              <h1 className="poppins" style={{ fontSize: '24px', fontWeight: '700', color: '#3F1D0B', letterSpacing: '-0.02em', margin: 0 }}>
                Bare Naked Pet Co.
              </h1>
              <p style={{ fontSize: '12px', color: '#3F1D0B', fontWeight: '500', margin: '2px 0 0 0' }}>Wholesale Portal</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setCurrentView('cart')}
              style={{ position: 'relative', padding: '10px', backgroundColor: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              <ShoppingCart size={20} color="#3F1D0B" />
              {cartItemCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#3F1D0B', color: 'white', fontSize: '12px', fontWeight: '700', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cartItemCount}
                </span>
              )}
            </button>

            <button
              onClick={handleLogout}
              style={{ padding: '10px', backgroundColor: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              <LogOut size={20} color="#3F1D0B" />
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setCurrentView('catalog')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentView === 'catalog' ? '#3F1D0B' : '#F7F1E0',
              color: currentView === 'catalog' ? 'white' : '#3F1D0B'
            }}
          >
            Product Catalog
          </button>
          <button
            onClick={() => setCurrentView('orders')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentView === 'orders' ? '#3F1D0B' : '#F7F1E0',
              color: currentView === 'orders' ? 'white' : '#3F1D0B'
            }}
          >
            Order History
          </button>
          <button
            onClick={() => setCurrentView('account')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: currentView === 'account' ? '#3F1D0B' : '#F7F1E0',
              color: currentView === 'account' ? 'white' : '#3F1D0B'
            }}
          >
            Account
          </button>
        </div>

        {currentView === 'catalog' && (
          <div style={{ display: 'flex', gap: '24px' }}>
            {/* Category Sidebar */}
            <div style={{ width: '200px', flexShrink: 0 }}>
              <div style={{ position: 'sticky', top: '100px' }}>
                <h3 className="poppins" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#3F1D0B' }}>
                  Categories
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['All', 'Toppers', 'Treats'].map(category => (
                    <button
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: categoryFilter === category ? '#3F1D0B' : '#F7F1E0',
                        color: categoryFilter === category ? 'white' : '#3F1D0B',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '32px', maxWidth: '600px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={20} color="#3F1D0B" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', paddingLeft: '48px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px', backgroundColor: '#F7F1E0', borderRadius: '6px', border: '1px solid #EFE6CB', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {filteredProducts.map((product) => (
                  <div key={product.id} style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #EFE6CB' }}>
                    <div style={{ aspectRatio: '1', backgroundColor: '#F7F1E0', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <h3 className="poppins" style={{ fontSize: '18px', fontWeight: '600', color: '#3F1D0B', margin: '0 0 4px 0' }}>
                            {product.name} {product.size}
                          </h3>
                        </div>
                        <span style={{ backgroundColor: '#EFE6CB', color: '#3F1D0B', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                          {product.category}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: '#3F1D0B', opacity: 0.7, marginBottom: '16px' }}>{product.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span className="poppins" style={{ fontSize: '24px', fontWeight: '700', color: '#3F1D0B' }}>
                            ${parseFloat(product.price).toFixed(2)}
                          </span>
                          <span style={{ fontSize: '14px', color: '#3F1D0B', opacity: 0.6, marginLeft: '4px' }}>/unit</span>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          style={{ backgroundColor: '#3F1D0B', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '500', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Plus size={16} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'cart' && (
          <div style={{ maxWidth: '896px', margin: '0 auto' }}>
            <h2 className="poppins" style={{ fontSize: '32px', fontWeight: '700', marginBottom: '32px', color: '#3F1D0B', letterSpacing: '-0.02em' }}>
              Shopping Cart
            </h2>

            {cart.length === 0 ? (
              <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '48px', textAlign: 'center', border: '1px solid #EFE6CB' }}>
                <ShoppingCart size={64} color="#EFE6CB" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: '#3F1D0B', fontSize: '18px', marginBottom: '24px' }}>Your cart is empty</p>
                <button
                  onClick={() => setCurrentView('catalog')}
                  style={{ backgroundColor: '#3F1D0B', color: 'white', padding: '12px 32px', borderRadius: '6px', fontWeight: '500', border: 'none', cursor: 'pointer' }}
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <div>
                {cart.map((item) => (
                  <div key={item.id} style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '20px', marginBottom: '20px', border: '1px solid #EFE6CB', display: 'flex', gap: '20px' }}>
                    <img src={item.image_url} alt={item.name} style={{ width: '96px', height: '96px', objectFit: 'contain', backgroundColor: '#F7F1E0', borderRadius: '6px', padding: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <h3 className="poppins" style={{ fontSize: '18px', fontWeight: '600', color: '#3F1D0B', margin: '0 0 4px 0' }}>
                            {item.name} {item.size}
                          </h3>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
                        >
                          <Trash2 size={20} color="#3F1D0B" style={{ opacity: 0.5 }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: '#EFE6CB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={16} color="#3F1D0B" />
                          </button>
                          <span style={{ fontWeight: '600', fontSize: '18px', width: '48px', textAlign: 'center', color: '#3F1D0B' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: '#EFE6CB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={16} color="#3F1D0B" />
                          </button>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '14px', color: '#3F1D0B', opacity: 0.6, margin: '0 0 4px 0' }}>
                            ${parseFloat(item.price).toFixed(2)} × {item.quantity}
                          </p>
                          <p className="poppins" style={{ fontSize: '20px', fontWeight: '700', color: '#3F1D0B', margin: 0 }}>
                            ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '32px', border: '1px solid #EFE6CB', marginTop: '24px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', marginBottom: '16px' }}>
                      <span style={{ color: '#3F1D0B' }}>Subtotal:</span>
                      <span style={{ fontWeight: '600', color: '#3F1D0B' }}>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', marginBottom: '16px' }}>
                      <span style={{ color: '#3F1D0B' }}>Shipping:</span>
                      <span style={{ fontWeight: '600', color: '#16a34a' }}>FREE</span>
                    </div>
                    <div style={{ borderTop: '1px solid #EFE6CB', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '24px' }}>
                        <span className="poppins" style={{ fontWeight: '700', color: '#3F1D0B' }}>Total:</span>
                        <span className="poppins" style={{ fontWeight: '700', color: '#3F1D0B' }}>
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Requested Delivery Date
                    </label>
                    <input
                      type="date"
                      id="deliveryDate"
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                      Promotion Code (optional)
                    </label>
                    <input
                      type="text"
                      id="promotionCode"
                      placeholder="Enter code if applicable"
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    onClick={() => {
                      const deliveryDate = (document.getElementById('deliveryDate') as HTMLInputElement).value;
                      submitOrder(deliveryDate);
                    }}
                    style={{ width: '100%', backgroundColor: '#3F1D0B', color: 'white', fontWeight: '600', padding: '16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <CreditCard size={20} />
                    Submit Order
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '14px', color: '#3F1D0B', opacity: 0.6, marginTop: '16px' }}>
                    You'll receive an order confirmation email • Invoice within 24 hours
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'orders' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 className="poppins" style={{ fontSize: '32px', fontWeight: '700', marginBottom: '32px', color: '#3F1D0B', letterSpacing: '-0.02em' }}>
              Order History
            </h2>

            {/* Analytics Tiles */}
            {orders.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Total Wholesale Spent */}
                <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '24px', border: '1px solid #EFE6CB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#3F1D0B', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={24} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', color: '#3F1D0B', opacity: 0.7, margin: 0 }}>Total Wholesale Spent</p>
                      <p className="poppins" style={{ fontSize: '28px', fontWeight: '700', color: '#3F1D0B', margin: '4px 0 0 0' }}>
                        ${analytics.totalWholesale.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total MSRP Value */}
                <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '24px', border: '1px solid #EFE6CB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#3F1D0B', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={24} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', color: '#3F1D0B', opacity: 0.7, margin: 0 }}>Total MSRP Value</p>
                      <p className="poppins" style={{ fontSize: '28px', fontWeight: '700', color: '#3F1D0B', margin: '4px 0 0 0' }}>
                        ${analytics.totalMSRP.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Potential Profit */}
                <div style={{ backgroundColor: '#dcfce7', borderRadius: '8px', padding: '24px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#16a34a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={24} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>Potential Profit</p>
                      <p className="poppins" style={{ fontSize: '28px', fontWeight: '700', color: '#166534', margin: '4px 0 0 0' }}>
                        ${analytics.potentialProfit.toFixed(2)}
                      </p>
                      <p style={{ fontSize: '12px', color: '#166534', opacity: 0.8, margin: '4px 0 0 0' }}>
                        {analytics.profitMargin.toFixed(1)}% margin
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            {orders.length === 0 ? (
              <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '48px', textAlign: 'center', border: '1px solid #EFE6CB' }}>
                <Package size={64} color="#EFE6CB" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: '#3F1D0B', fontSize: '18px' }}>No orders yet</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '24px', marginBottom: '16px', border: '1px solid #EFE6CB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '56px', height: '56px', backgroundColor: '#EFE6CB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={28} color="#3F1D0B" />
                    </div>
                    <div>
                      <p className="poppins" style={{ fontSize: '18px', fontWeight: '600', color: '#3F1D0B', margin: '0 0 4px 0' }}>
                        Order {order.id}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#3F1D0B', opacity: 0.7 }}>
                        <span>{order.date}</span>
                        <span>{order.items} items</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: '500', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', marginBottom: '8px' }}>
                      {order.status}
                    </span>
                    <p className="poppins" style={{ fontSize: '20px', fontWeight: '700', color: '#3F1D0B', margin: 0 }}>
                      ${order.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {currentView === 'account' && userData && (
          <div style={{ maxWidth: '672px', margin: '0 auto' }}>
            <h2 className="poppins" style={{ fontSize: '32px', fontWeight: '700', marginBottom: '32px', color: '#3F1D0B', letterSpacing: '-0.02em' }}>
              Account Information
            </h2>

            <div style={{ backgroundColor: '#F7F1E0', borderRadius: '8px', padding: '32px', border: '1px solid #EFE6CB' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                  Business Name
                </label>
                <input
                  type="text"
                  defaultValue={userData.business_name}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  defaultValue={userData.email}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                  Business Address
                </label>
                <input
                  type="text"
                  defaultValue={userData.business_address}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  defaultValue={userData.phone}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#3F1D0B', marginBottom: '8px' }}>
                  Account Number
                </label>
                <input
                  type="text"
                  value={userData.account_number}
                  disabled
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #EFE6CB', backgroundColor: 'white', color: '#3F1D0B', opacity: 0.5, fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                onClick={() => showNotificationPopup('Account information updated!')}
                style={{ width: '100%', backgroundColor: '#3F1D0B', color: 'white', fontWeight: '600', padding: '16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '16px' }}
              >
                Save Changes
              </button>
            </div>

            <div style={{ marginTop: '32px', backgroundColor: 'white', border: '1px solid #EFE6CB', borderRadius: '8px', padding: '24px' }}>
              <h3 className="poppins" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#3F1D0B' }}>
                Wholesale Benefits
              </h3>
              <div style={{ fontSize: '14px', color: '#3F1D0B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle size={16} color="#3F1D0B" />
                  Free shipping on all orders
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle size={16} color="#3F1D0B" />
                  No minimum order quantity
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle size={16} color="#3F1D0B" />
                  Net 30 payment terms
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="#3F1D0B" />
                  Dedicated account manager
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
