'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ShoppingCart, User, LogOut, Package, Calendar, CreditCard, Clock, Search, Plus, Minus, Trash2, CheckCircle, TrendingUp, Box } from 'lucide-react';

export default function WholesalePortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('login');
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const supabase = createClientComponentClient();

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
        order_items(*)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      const formattedOrders = data.map(order => ({
        id: order.order_number,
        date: new Date(order.created_at).toLocaleDateString(),
        status: order.status === 'pending' ? 'Processing' : 'Delivered',
        total: parseFloat(order.total),
        items: order.order_items.reduce((sum, item) => sum + item.quantity, 0)
      }));
      setOrders(formattedOrders);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

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

  const submitOrder = async (deliveryDate) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryDate: deliveryDate || null,
          promotionCode: document.getElementById('promotionCode')?.value || null
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

  const addToCart = (product) => {
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

  const updateQuantity = (productId, change) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
    showNotificationPopup('Item removed');
  };

  const showNotificationPopup = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <p style={{ fontSize: '14px', color: '#3F1D0B' }}>
                New retailer?{' '}
                <a href="mailto:info@barenakedpet.com" style={{ color: '#3F1D0B', textDecoration: 'underline', fontWeight: '500' }}>
                  Apply for wholesale account
                </a>
              </p>
            </div>
          </div>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: '#3F1D0B' }}>
            <p>Free shipping • No minimums</p>
          </div>
        </div>
      </div>
    );
  }

  // Rest of the portal UI remains the same from the previous version...
  // (I'll include the full component in the final file)
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#EFE6CB' }}>
      {/* Portal content - same as before but with real data */}
      <p>Portal loaded - Full UI will be in complete file</p>
    </div>
  );
}
