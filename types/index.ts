export interface Retailer {
  id: string;
  company_name: string;
  business_name?: string;
  business_address: string;
  phone: string;
  account_number: string;
  logo_url?: string | null;
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
  is_public?: boolean;
  public_display_name?: string | null;
  public_address?: string | null;
  public_phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  public_hours?: string | null;
  public_notes?: string | null;
  locator_updated_at?: string | null;
  locator_verified_at?: string | null;
  geocoded_at?: string | null;
  geocoding_error?: string | null;
  google_place_id?: string | null;
  google_place_match_confidence?: number | null;
  google_place_matched_at?: string | null;
  google_place_match_error?: string | null;
  google_place_url?: string | null;
  google_place_autofilled_at?: string | null;
  google_place_review_status?: GooglePlaceReviewStatus | null;
  google_place_reviewed_at?: string | null;
  google_place_review_notes?: string | null;
  created_at?: string;
}

export type GooglePlaceReviewStatus =
  | 'needs_review'
  | 'high_confidence'
  | 'low_confidence'
  | 'no_listing'
  | 'approved_portal_data'
  | 'use_google_manually'
  | 'dismissed';

export interface PublicStoreLocatorLocation {
  id: string;
  retailer_id: string;
  name: string;
  address: string;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: string | null;
  notes: string | null;
  logo_url: string | null;
  last_updated_at: string | null;
  verified_at: string | null;
}

export type StoreNominationStatus = 'new' | 'reviewing' | 'contacted' | 'converted' | 'dismissed';

export interface StoreNomination {
  id: string;
  consumer_name: string;
  consumer_email: string;
  consumer_phone?: string | null;
  store_name: string;
  store_address?: string | null;
  store_city?: string | null;
  store_state?: string | null;
  store_postal_code?: string | null;
  store_url?: string | null;
  note?: string | null;
  status: StoreNominationStatus;
  admin_notes?: string | null;
  source?: string | null;
  landing_page_url?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
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
  credit_applied?: number;
  promotion_discount_applied?: number;
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
  bar_message?: string | null;
  is_active: boolean;
  popup_enabled?: boolean | null;
  popup_headline?: string | null;
  popup_body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  version?: number | null;
  targeting_type?: string | null;
  manual_retailer_ids?: string[] | null;
  linked_discount_code_id?: string | null;
  inherit_discount_eligibility?: boolean | null;
  created_at: string;
  updated_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string | null;
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

export interface Conversation {
  id: string;
  retailer_id: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_sender_role?: 'retailer' | 'admin' | null;
  last_read_by_retailer_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_role: 'retailer' | 'admin';
  sender_id: string;
  sender_name?: string | null;
  body: string;
  created_at: string;
}

export interface OnboardingChecklistItemState {
  item_id: string;
  completed: boolean;
  agreed_value?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

export interface OnboardingNote {
  id: string;
  onboarding_id: string;
  body: string;
  source: 'portal' | 'pipedrive_sync';
  pipedrive_note_id?: number | null;
  created_by?: string | null;
  created_at: string;
}

export interface LinkedPipedriveDealSummary {
  id: number;
  title: string;
  stageId: number | null;
  stageName: string;
  ownerName: string | null;
  orgName: string | null;
  addTime: string | null;
  updateTime: string | null;
  status: string | null;
}

export interface RetailerOnboarding {
  id: string;
  retailer_id: string;
  pipedrive_deal_id: number | null;
  pipedrive_stage_name?: string | null;
  first_order_received_at?: string | null;
  second_order_received_at?: string | null;
  third_order_received_at?: string | null;
  next_follow_up_at?: string | null;
  follow_up_status?: 'upcoming' | 'due' | 'overdue' | 'complete' | 'needs_link';
  owner_name?: string | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
  retailer?: Retailer | null;
  checklist_items?: OnboardingChecklistItemState[];
  notes?: OnboardingNote[];
  linked_deal?: LinkedPipedriveDealSummary | null;
}
