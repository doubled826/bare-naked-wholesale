export interface Retailer {
  id: string;
  company_name: string;
  business_name?: string;
  business_address: string;
  phone: string;
  account_number: string;
  email?: string;
  tax_id?: string;  // Add this line
  created_at?: string;
  updated_at?: string;
}

export interface RetailerLocation {
  id: string;
  retailer_id: string;
  location_name: string;
  business_address: string;
  phone?: string | null;
  is_default: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  size: string;
  category: string;
  description: string;
  price: number;
  msrp?: number;
  image_url: string;
  in_stock?: boolean;
  stock_quantity?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  retailer_id: string;
  location_id?: string | null;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  delivery_date?: string;
  promotion_code?: string;
  tracking_number?: string;
  tracking_carrier?: string;
  include_samples?: boolean;
  invoice_url?: string;
  invoice_sent_at?: string;
  invoice_sent_count?: number;
  shipped_at?: string;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at?: string;
  order_items?: OrderItem[];
  retailer?: Retailer;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  message: string;
  email_type: 'order_update' | 'announcement' | 'shipping';
  order_id?: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
}

export interface NotificationType {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRetailers: number;
  totalProducts: number;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  category?: string;
  file_url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  preview_url?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}
