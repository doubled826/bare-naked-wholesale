'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, ExternalLink, Image, Loader2, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LibraryImage = {
  name: string;
  path: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const formatFileSize = (size?: number | null) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date?: string | null) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
};

export default function AdminLibraryImagesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filteredImages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return images;
    return images.filter((image) =>
      image.name.toLowerCase().includes(query) ||
      image.path.toLowerCase().includes(query) ||
      (image.mimeType || '').toLowerCase().includes(query),
    );
  }, [images, searchQuery]);

  useEffect(() => {
    loadImages();
  }, []);

  const showNotice = (message: string, type: 'success' | 'error') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3000);
  };

  async function loadImages() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/library/images');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to load images.');
      setImages(payload.images || []);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to load images.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadImage() {
    if (!selectedFile) {
      showNotice('Choose an image to upload.', 'error');
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      showNotice('Only image files can be uploaded here.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/library/images', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to upload image.');

      setImages((current) => [payload.image, ...current]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showNotice('Image uploaded.', 'success');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to upload image.', 'error');
    } finally {
      setIsUploading(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showNotice('Image URL copied.', 'success');
    } catch {
      showNotice('Unable to copy URL.', 'error');
    }
  }

  async function deleteImage(image: LibraryImage) {
    if (!window.confirm(`Delete ${image.name}?`)) return;

    setDeletingPath(image.path);
    try {
      const response = await fetch('/api/admin/library/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: image.path }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to delete image.');

      setImages((current) => current.filter((item) => item.path !== image.path));
      showNotice('Image deleted.', 'success');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to delete image.', 'error');
    } finally {
      setDeletingPath('');
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={cn(
            'fixed right-6 top-20 z-50 flex items-center gap-3 rounded-xl border p-4 shadow-lg',
            notice.type === 'success' ? 'border-gray-200 bg-white text-gray-900' : 'border-red-200 bg-red-50 text-red-900',
          )}
        >
          {notice.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-cream-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Images
            </h1>
            <p className="mt-1 text-sm text-bark-500/60">
              Upload reusable images for email campaigns, announcements, product pages, and other admin content.
            </p>
          </div>
          <div className="rounded-lg bg-cream-50 px-4 py-3 text-sm text-bark-500">
            <span className="font-semibold">{images.length}</span> image{images.length === 1 ? '' : 's'} in the library
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Upload image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-gray-200 px-4 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-cream-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bark-500 hover:file:bg-cream-200"
            />
            {selectedFile && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedFile.name} - {formatFileSize(selectedFile.size)}
              </p>
            )}
          </div>
          <button
            onClick={uploadImage}
            disabled={isUploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bark-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search image names..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-bark-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-bark-500" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <Image className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 font-medium text-gray-900">No images found</p>
          <p className="mt-1 text-sm text-gray-500">Upload the first reusable image for campaigns and content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredImages.map((image) => (
            <div key={image.path} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="aspect-video bg-gray-100">
                <img src={image.url} alt={image.name} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="truncate font-semibold text-gray-900" title={image.name}>{image.name}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatFileSize(image.size)} - {image.mimeType || 'image'} - {formatDate(image.createdAt)}
                  </p>
                </div>
                <input
                  readOnly
                  value={image.url}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyUrl(image.url)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Copy className="h-4 w-4" />
                    Copy URL
                  </button>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-50"
                    aria-label={`Open ${image.name}`}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                  <button
                    onClick={() => deleteImage(image)}
                    disabled={deletingPath === image.path}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Delete ${image.name}`}
                  >
                    {deletingPath === image.path ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
