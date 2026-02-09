'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Resource } from '@/types';

const categorySuggestions = ['Training', 'Marketing', 'Signage', 'Sales', 'Operations'];

const formatFileSize = (size?: number) => {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyResource: Partial<Resource> = {
  title: '',
  description: '',
  category: 'Training',
  file_url: '',
  file_name: '',
  file_type: '',
  file_size: 0,
  preview_url: '',
  sort_order: 0,
  is_active: true,
};

export default function AdminResourcesPage() {
  const supabase = createClientComponentClient();
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState<Partial<Resource>>(emptyResource);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    filterResources();
  }, [resources, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const set = new Set(
      resources
        .map((resource) => resource.category)
        .filter((category): category is string => Boolean(category))
    );
    return ['All', ...Array.from(set).sort()];
  }, [resources]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources((data || []) as Resource[]);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterResources = () => {
    let filtered = [...resources];

    if (activeCategory !== 'All') {
      filtered = filtered.filter((resource) => resource.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((resource) =>
        resource.title.toLowerCase().includes(query) ||
        (resource.description || '').toLowerCase().includes(query)
      );
    }

    setFilteredResources(filtered);
  };

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  };

  const handleAddResource = () => {
    setIsEditing(false);
    setSelectedResource(null);
    setSelectedFile(null);
    setSelectedPreviewFile(null);
    setFormData(emptyResource);
    setShowModal(true);
  };

  const handleEditResource = (resource: Resource) => {
    setIsEditing(true);
    setSelectedResource(resource);
    setSelectedFile(null);
    setSelectedPreviewFile(null);
    setFormData({
      title: resource.title,
      description: resource.description || '',
      category: resource.category || 'Training',
      file_url: resource.file_url,
      file_name: resource.file_name || '',
      file_type: resource.file_type || '',
      file_size: resource.file_size || 0,
      preview_url: resource.preview_url || '',
      sort_order: resource.sort_order || 0,
      is_active: resource.is_active !== false,
    });
    setShowModal(true);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/admin/resources/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload');
    }

    return response.json();
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      showNotificationMessage('Please add a title', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = formData.file_url || '';
      let fileName = formData.file_name || '';
      let fileType = formData.file_type || '';
      let fileSize = formData.file_size || 0;
      let previewUrl = formData.preview_url || '';

      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        fileUrl = uploadResult.url;
        fileName = uploadResult.name;
        fileType = uploadResult.type;
        fileSize = uploadResult.size;
        if (!previewUrl && uploadResult.type?.startsWith('image/')) {
          previewUrl = uploadResult.url;
        }
      }

      if (selectedPreviewFile) {
        const previewUpload = await uploadFile(selectedPreviewFile);
        previewUrl = previewUpload.url;
      }

      if (!fileUrl) {
        showNotificationMessage('Add a file upload or URL', 'error');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        preview_url: previewUrl,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== false,
      };

      if (isEditing && selectedResource) {
        const { error } = await supabase
          .from('resources')
          .update(payload)
          .eq('id', selectedResource.id);

        if (error) throw error;
        showNotificationMessage('Resource updated!', 'success');
      } else {
        const { error } = await supabase.from('resources').insert(payload);
        if (error) throw error;
        showNotificationMessage('Resource added!', 'success');
      }

      setShowModal(false);
      setSelectedResource(null);
      setSelectedFile(null);
      fetchResources();
    } catch (error) {
      console.error('Error saving resource:', error);
      showNotificationMessage('Failed to save resource', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!selectedResource) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', selectedResource.id);

      if (error) throw error;

      showNotificationMessage('Resource deleted!', 'success');
      setShowDeleteConfirm(false);
      setSelectedResource(null);
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      showNotificationMessage('Failed to delete', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification.message && (
        <div
          className={cn(
            'fixed top-20 right-6 z-50 border rounded-xl p-4 shadow-lg flex items-center gap-3',
            notification.type === 'success'
              ? 'bg-white border-gray-200'
              : 'bg-red-50 border-red-200'
          )}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span
            className={notification.type === 'success' ? 'text-gray-900' : 'text-red-900'}
          >
            {notification.message}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  activeCategory === category
                    ? 'bg-bark-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddResource}
              className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </button>
          </div>
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <div className="col-span-full bg-white rounded-xl p-12 text-center border border-gray-100">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No resources found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResources.map((resource) => (
            <div
              key={resource.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center">
                {resource.preview_url ? (
                  <img
                    src={resource.preview_url}
                    alt={resource.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{resource.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {resource.description || '—'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      resource.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {resource.is_active !== false ? 'Active' : 'Hidden'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{resource.category || 'Resource'}</span>
                  <span>{formatFileSize(resource.file_size)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-bark-500 hover:text-bark-600"
                  >
                    <Download className="w-4 h-4" />
                    Preview
                  </a>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditResource(resource)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedResource(resource);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Resource' : 'Add New Resource'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    list="resource-categories"
                    value={formData.category || ''}
                    onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                  <datalist id="resource-categories">
                    {categorySuggestions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order ?? 0}
                    onChange={(event) =>
                      setFormData({ ...formData, sort_order: parseInt(event.target.value, 10) || 0 })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col gap-3">
                    <input
                      type="file"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      className="text-sm text-gray-600"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <UploadCloud className="w-4 h-4" />
                      Uploads go to Supabase Storage bucket: <span className="font-semibold">resources</span>
                    </div>
                    {selectedFile && (
                      <div className="text-xs text-gray-500">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">File URL</label>
                  <input
                    type="text"
                    value={formData.file_url || ''}
                    onChange={(event) => setFormData({ ...formData, file_url: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use this if the file is hosted elsewhere or you are not uploading a file.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image</label>
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setSelectedPreviewFile(event.target.files?.[0] || null)}
                      className="text-sm text-gray-600"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <UploadCloud className="w-4 h-4" />
                      Optional image used as the resource thumbnail.
                    </div>
                    {selectedPreviewFile ? (
                      <div className="text-xs text-gray-500">
                        Selected: {selectedPreviewFile.name} ({formatFileSize(selectedPreviewFile.size)})
                      </div>
                    ) : formData.preview_url ? (
                      <div className="text-xs text-gray-500">
                        Current: {formData.preview_url}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active !== false}
                      onChange={(event) =>
                        setFormData({ ...formData, is_active: event.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                    />
                    <span className="text-sm text-gray-700">Active (visible to retailers)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isEditing ? (
                    'Update Resource'
                  ) : (
                    'Add Resource'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedResource && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Resource</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{selectedResource.title}"?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedResource(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteResource}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
