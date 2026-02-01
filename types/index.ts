export interface Retailer {
  id: string;
  company_name: string;
  business_name?: string; // Keep for backwards compatibility
  business_address: string;
  phone: string;
  account_number: string;
  tax_id?: string;
  status?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
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
}

export interface Order {
  id: string;
  order_number: string;
  retailer_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  delivery_date?: string;
  promotion_code?: string;
  subtotal: number;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
}

export interface NotificationType {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
