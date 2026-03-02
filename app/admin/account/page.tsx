'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Check, ImagePlus, Loader2, User } from 'lucide-react';

export default function AdminAccountPage() {
  const supabase = createClientComponentClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadAvatar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      setAvatarUrl(data?.avatar_url ?? null);
    };

    loadAvatar();
  }, [supabase]);

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const handleUpload = async () => {
    if (!avatarFile || isUploading) return;
    setIsUploading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      const extension = avatarFile.name.split('.').pop() || 'png';
      const path = `admins/${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(path, avatarFile, { cacheControl: '3600', upsert: true, contentType: avatarFile.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(data.publicUrl);
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (isUploading) return;
    setIsUploading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      const { error } = await supabase
        .from('admin_users')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setAvatarUrl(null);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove image.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <User className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Account Settings
            </h1>
            <p className="text-sm text-gray-600">Manage how the team shows up in the community feed.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <ImagePlus className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Team Logo
            </h2>
            <p className="text-sm text-gray-600">Recommended for a polished, professional presence.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
              {avatarPreview || avatarUrl ? (
                <img src={avatarPreview || avatarUrl || ''} alt="Admin logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-sm font-semibold text-bark-500">BN</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Upload a logo or profile image</p>
              <p className="text-xs text-gray-500">Best when square and high-contrast.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-bark-500 hover:text-bark-600 hover:bg-bark-100 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                  }
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
              <ImagePlus className="w-4 h-4" />
              Choose Logo
            </label>
            <button
              type="button"
              onClick={handleUpload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-bark-500 text-white hover:bg-bark-600 transition-colors disabled:opacity-50"
              disabled={!avatarFile || isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
            </button>
            {(avatarUrl || avatarPreview) && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                disabled={isUploading}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <Check className="w-4 h-4" />
            Logo updated.
          </div>
        )}
        {status === 'error' && <div className="text-sm text-red-600">{errorMessage}</div>}
      </div>
    </div>
  );
}
