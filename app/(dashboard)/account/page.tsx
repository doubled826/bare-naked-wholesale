'use client';

import { useState, useEffect } from 'react';
import { 
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Lock,
  Save,
  Loader2,
  Check,
  CheckCircle,
  FileText,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AccountPage() {
  const { retailer } = useAppStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  
  const supabase = createClientComponentClient();

  // Fetch user metadata on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        setUserMetadata(user.user_metadata);
      }
    };
    fetchUserData();
  }, [supabase.auth]);

  const [profile, setProfile] = useState({
    businessName: '',
    businessAddress: '',
    name: '',
    email: '',
    phone: '',
    taxId: '',
    accountNumber: '',
  });

  // Update profile state when retailer or userMetadata changes
  useEffect(() => {
    setProfile({
      businessName: retailer?.company_name || userMetadata?.company_name || '',
      businessAddress: retailer?.business_address || userMetadata?.business_address || '',
      name: userMetadata?.display_name || userMetadata?.full_name || '',
      email: userMetadata?.email || '',
      phone: retailer?.phone || userMetadata?.phone || '',
      taxId: retailer?.tax_id || userMetadata?.tax_id || '',
      accountNumber: retailer?.account_number || '',
    });
  }, [retailer, userMetadata]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Update user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          display_name: profile.name,
          full_name: profile.name,
          phone: profile.phone,
          company_name: profile.businessName,
          business_address: profile.businessAddress,
          tax_id: profile.taxId,
        }
      });

      if (userError) throw userError;

      // Update retailer table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: retailerError } = await supabase
          .from('retailers')
          .update({
            company_name: profile.businessName,
            business_address: profile.businessAddress,
            phone: profile.phone,
            tax_id: profile.taxId,
          })
          .eq('id', user.id);

        if (retailerError) throw retailerError;
      }

      await fetch('/api/account/notify-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: profile.businessName,
          businessAddress: profile.businessAddress,
          name: profile.name,
          phone: profile.phone,
          taxId: profile.taxId,
          accountNumber: profile.accountNumber,
        }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: Building },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Account Settings</h1>
        <p className="text-bark-500/70 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="card p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-bark-500 text-white'
                    : 'text-bark-500/70 hover:bg-cream-200 hover:text-bark-500'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="card p-6">
              <h2 className="section-title mb-6">Business Profile</h2>

              <div className="space-y-6">
                {/* Account Number (readonly) */}
                <div>
                  <label htmlFor="accountNumber" className="label">Account Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="accountNumber"
                      type="text"
                      value={profile.accountNumber}
                      disabled
                      className="input pl-10 opacity-60 cursor-not-allowed bg-cream-200"
                    />
                  </div>
                  <p className="text-xs text-bark-500/50 mt-1">Your unique wholesale account number</p>
                </div>

                {retailer?.invoice_url && (
                  <div className="p-4 bg-cream-200 rounded-xl">
                    <p className="text-sm text-bark-500/70 mb-3">QuickBooks Invoice</p>
                    <a
                      href={retailer.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary inline-flex items-center"
                    >
                      View Invoice
                    </a>
                  </div>
                )}

                {/* Business Name */}
                <div>
                  <label htmlFor="businessName" className="label">Business Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="businessName"
                      type="text"
                      value={profile.businessName}
                      onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                      className="input pl-10"
                    />
                  </div>
                </div>

                {/* Business Address */}
                <div>
                  <label htmlFor="businessAddress" className="label">Business Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="businessAddress"
                      type="text"
                      value={profile.businessAddress}
                      onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })}
                      className="input pl-10"
                    />
                  </div>
                </div>

                {/* Contact Name */}
                <div>
                  <label htmlFor="name" className="label">Contact Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="name"
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="input pl-10"
                    />
                  </div>
                </div>

                {/* Email (readonly - managed by auth) */}
                <div>
                  <label htmlFor="email" className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                      className="input pl-10 opacity-60 cursor-not-allowed bg-cream-200"
                    />
                  </div>
                  <p className="text-xs text-bark-500/50 mt-1">Contact support to change your email</p>
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="label">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="input pl-10"
                    />
                  </div>
                </div>

                {/* Tax ID / EIN */}
                <div>
                  <label htmlFor="taxId" className="label">Tax ID / EIN</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
                    <input
                      id="taxId"
                      type="text"
                      value={profile.taxId}
                      onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                      className="input pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-cream-200 flex items-center justify-between">
                <div>
                  {saved && (
                    <span className="text-sm text-emerald-600 flex items-center gap-2 animate-fade-in">
                      <Check className="w-4 h-4" />
                      Changes saved
                    </span>
                  )}
                </div>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="card p-6">
              <h2 className="section-title mb-6">Security Settings</h2>

              <div className="space-y-6">
                {/* Change Password */}
                <div className="p-4 bg-cream-200 rounded-xl">
                  <h3 className="font-semibold text-bark-500 mb-2">Change Password</h3>
                  <p className="text-sm text-bark-500/70 mb-4">
                    Update your password to keep your account secure
                  </p>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="label">Current Password</label>
                      <input type="password" className="input" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input type="password" className="input" placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="label">Confirm New Password</label>
                      <input type="password" className="input" placeholder="••••••••" />
                    </div>
                  </div>
                  <button className="btn-primary mt-4">
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wholesale Benefits Card */}
          <div className="card p-6 mt-6">
            <h3 className="section-title mb-4">Your Wholesale Benefits</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-bark-500">Free shipping on all orders</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-bark-500">No minimum order quantity</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-bark-500">Net 30 payment terms</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-bark-500">Dedicated account manager</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
