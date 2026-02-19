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
  Hash,
  Plus,
  Trash2,
  Edit2,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { RetailerLocation } from '@/types';

export default function AccountPage() {
  const { retailer } = useAppStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [locations, setLocations] = useState<RetailerLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    location_name: '',
    business_address: '',
    phone: '',
    makeDefault: false,
  });
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState({
    location_name: '',
    business_address: '',
    phone: '',
  });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isDeletingLocationId, setIsDeletingLocationId] = useState<string | null>(null);
  const [isSettingDefaultId, setIsSettingDefaultId] = useState<string | null>(null);
  
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

  const showLocationNotice = (message: string) => {
    setLocationNotice(message);
    setTimeout(() => setLocationNotice(''), 3000);
  };

  const fetchLocations = async () => {
    setLocationsLoading(true);
    setLocationsError('');
    const { data, error } = await supabase
      .from('retailer_locations')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading locations:', error);
      setLocationsError('Unable to load locations.');
      setLocationsLoading(false);
      return;
    }

    setLocations((data || []) as RetailerLocation[]);
    setLocationsLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, [supabase]);

  const handleAddLocation = async () => {
    if (!newLocation.location_name.trim() || !newLocation.business_address.trim()) {
      showLocationNotice('Location name and address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showLocationNotice('Please sign in again.');
        return;
      }

      const shouldBeDefault = newLocation.makeDefault || locations.length === 0;
      const { data: insertedLocation, error } = await supabase
        .from('retailer_locations')
        .insert({
          retailer_id: user.id,
          location_name: newLocation.location_name.trim(),
          business_address: newLocation.business_address.trim(),
          phone: newLocation.phone.trim() || null,
          is_default: shouldBeDefault,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (shouldBeDefault && insertedLocation?.id) {
        await supabase
          .from('retailer_locations')
          .update({ is_default: false })
          .eq('retailer_id', user.id)
          .neq('id', insertedLocation.id);
      }

      setNewLocation({ location_name: '', business_address: '', phone: '', makeDefault: false });
      setShowAddLocation(false);
      showLocationNotice('Location added.');
      fetchLocations();
    } catch (error) {
      console.error('Error adding location:', error);
      showLocationNotice('Failed to add location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleEditLocation = (location: RetailerLocation) => {
    setEditLocationId(location.id);
    setEditLocation({
      location_name: location.location_name,
      business_address: location.business_address,
      phone: location.phone || '',
    });
  };

  const handleUpdateLocation = async () => {
    if (!editLocationId) return;
    if (!editLocation.location_name.trim() || !editLocation.business_address.trim()) {
      showLocationNotice('Location name and address are required.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const { error } = await supabase
        .from('retailer_locations')
        .update({
          location_name: editLocation.location_name.trim(),
          business_address: editLocation.business_address.trim(),
          phone: editLocation.phone.trim() || null,
        })
        .eq('id', editLocationId);

      if (error) {
        throw error;
      }

      setEditLocationId(null);
      showLocationNotice('Location updated.');
      fetchLocations();
    } catch (error) {
      console.error('Error updating location:', error);
      showLocationNotice('Failed to update location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleSetDefaultLocation = async (locationId: string) => {
    setIsSettingDefaultId(locationId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showLocationNotice('Please sign in again.');
        return;
      }

      await supabase
        .from('retailer_locations')
        .update({ is_default: false })
        .eq('retailer_id', user.id);

      const { error } = await supabase
        .from('retailer_locations')
        .update({ is_default: true })
        .eq('id', locationId);

      if (error) {
        throw error;
      }

      showLocationNotice('Default location updated.');
      fetchLocations();
    } catch (error) {
      console.error('Error setting default location:', error);
      showLocationNotice('Failed to update default.');
    } finally {
      setIsSettingDefaultId(null);
    }
  };

  const handleDeleteLocation = async (location: RetailerLocation) => {
    setIsDeletingLocationId(location.id);
    try {
      const { error } = await supabase
        .from('retailer_locations')
        .delete()
        .eq('id', location.id);

      if (error) {
        throw error;
      }

      if (location.is_default) {
        const remaining = locations.filter((loc) => loc.id !== location.id);
        if (remaining.length > 0) {
          await supabase
            .from('retailer_locations')
            .update({ is_default: true })
            .eq('id', remaining[0].id);
        }
      }

      showLocationNotice('Location removed.');
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      showLocationNotice('Failed to delete location.');
    } finally {
      setIsDeletingLocationId(null);
    }
  };

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

  const handlePasswordUpdate = async () => {
    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        setPasswordError('Please fill out all password fields.');
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError('New password and confirmation do not match.');
        return;
      }

      if (passwordForm.newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setPasswordError('Unable to verify your account. Please sign in again.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('An unexpected error occurred. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: Building },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'locations', label: 'Locations', icon: MapPin },
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
                  {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Password updated successfully
                    </div>
                  )}
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="label">Current Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="••••••••"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="••••••••"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="label">Confirm New Password</label>
                      <input
                        type="password"
                        className="input"
                        placeholder="••••••••"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button
                    className="btn-primary mt-4"
                    onClick={handlePasswordUpdate}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                  <h2 className="section-title">Locations</h2>
                  <p className="text-sm text-bark-500/70 mt-1">Manage ship-to addresses for your orders</p>
                </div>
                <button onClick={() => setShowAddLocation(true)} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </button>
              </div>

              {locationNotice && (
                <div className="mb-4 p-3 bg-cream-200 rounded-xl text-sm text-bark-500">
                  {locationNotice}
                </div>
              )}

              {locationsError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {locationsError}
                </div>
              )}

              {showAddLocation && (
                <div className="mb-6 p-4 bg-cream-200 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Location Name</label>
                      <input
                        type="text"
                        className="input"
                        value={newLocation.location_name}
                        onChange={(e) => setNewLocation({ ...newLocation, location_name: e.target.value })}
                        placeholder="Warehouse, Storefront, etc."
                      />
                    </div>
                    <div>
                      <label className="label">Phone (Optional)</label>
                      <input
                        type="tel"
                        className="input"
                        value={newLocation.phone}
                        onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                        placeholder="(555) 555-5555"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Business Address</label>
                      <input
                        type="text"
                        className="input"
                        value={newLocation.business_address}
                        onChange={(e) => setNewLocation({ ...newLocation, business_address: e.target.value })}
                        placeholder="123 Main St, City, State ZIP"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-bark-500">
                    <input
                      type="checkbox"
                      checked={newLocation.makeDefault}
                      onChange={(e) => setNewLocation({ ...newLocation, makeDefault: e.target.checked })}
                      className="rounded border-cream-300 text-bark-500 focus:ring-bark-500"
                    />
                    Make this the default ship-to location
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleAddLocation} disabled={isSavingLocation} className="btn-primary">
                      {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Location'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddLocation(false);
                        setNewLocation({ location_name: '', business_address: '', phone: '', makeDefault: false });
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {locationsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-8 h-8 border-2 border-bark-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : locations.length === 0 ? (
                <div className="p-6 bg-cream-200 rounded-xl text-sm text-bark-500/70">
                  No locations added yet. Add a location to manage alternate ship-to addresses.
                </div>
              ) : (
                <div className="space-y-4">
                  {locations.map((location) => (
                    <div key={location.id} className="p-4 bg-cream-200 rounded-xl">
                      {editLocationId === location.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Location Name</label>
                              <input
                                type="text"
                                className="input"
                                value={editLocation.location_name}
                                onChange={(e) => setEditLocation({ ...editLocation, location_name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="label">Phone (Optional)</label>
                              <input
                                type="tel"
                                className="input"
                                value={editLocation.phone}
                                onChange={(e) => setEditLocation({ ...editLocation, phone: e.target.value })}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="label">Business Address</label>
                              <input
                                type="text"
                                className="input"
                                value={editLocation.business_address}
                                onChange={(e) => setEditLocation({ ...editLocation, business_address: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button onClick={handleUpdateLocation} disabled={isSavingLocation} className="btn-primary">
                              {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </button>
                            <button
                              onClick={() => setEditLocationId(null)}
                              className="btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-bark-500">{location.location_name}</p>
                              {location.is_default && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Star className="w-3 h-3" />
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-bark-500/70 mt-1">{location.business_address}</p>
                            {location.phone && (
                              <p className="text-sm text-bark-500/70 mt-1">{location.phone}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!location.is_default && (
                              <button
                                onClick={() => handleSetDefaultLocation(location.id)}
                                disabled={isSettingDefaultId === location.id}
                                className="btn-secondary"
                              >
                                {isSettingDefaultId === location.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Make Default'
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleEditLocation(location)}
                              className="btn-secondary"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(location)}
                              disabled={isDeletingLocationId === location.id}
                              className="btn-secondary text-red-600 hover:text-red-700"
                            >
                              {isDeletingLocationId === location.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
