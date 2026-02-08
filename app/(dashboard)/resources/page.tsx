'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Megaphone,
  GraduationCap,
  Search,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Resource } from '@/types';

const categoryMeta: Record<string, { label: string; icon: typeof FileText }> = {
  Training: { label: 'Training', icon: GraduationCap },
  Marketing: { label: 'Marketing', icon: Megaphone },
};

const formatFileSize = (size?: number) => {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (resource: Resource) => {
  if (resource.file_type?.startsWith('image/')) return ImageIcon;
  return FileText;
};

export default function ResourcesPage() {
  const supabase = createClientComponentClient();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const { data, error } = await supabase
          .from('resources')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setResources((data || []) as Resource[]);
      } catch (error) {
        console.error('Failed to load resources:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [supabase]);

  const categories = useMemo(() => {
    const set = new Set(
      resources
        .map((resource) => resource.category)
        .filter((category): category is string => Boolean(category))
    );
    return ['All', ...Array.from(set).sort()];
  }, [resources]);

  const filteredResources = useMemo(() => {
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

    return filtered;
  }, [resources, activeCategory, searchQuery]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div className="card relative overflow-hidden p-6 lg:p-8">
        <div className="absolute inset-0 pattern-dots opacity-40" />
        <div className="relative z-10">
          <p className="text-sm font-semibold text-bark-500/70 tracking-wide uppercase">Retailer Resources</p>
          <h1 className="page-title mt-2">Sell More With Ready-to-Use Materials</h1>
          <p className="text-bark-500/70 mt-3 max-w-2xl">
            Download training guides, signage, and marketing assets designed to help you educate staff and
            boost in-store sell-through.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-bark-500/70">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <Download className="w-4 h-4" />
              Print-ready formats
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200">
              <ArrowUpRight className="w-4 h-4" />
              Updated regularly
            </span>
          </div>
        </div>
      </div>

      <div className="card p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-500/40" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="input pl-10"
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
                    : 'bg-cream-200 text-bark-500 hover:bg-cream-300'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-bark-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-bark-500/40 mb-4" />
          <h2 className="section-title">No resources found</h2>
          <p className="text-bark-500/70 mt-2">Try adjusting your search or check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const FileIcon = getFileIcon(resource);
            const categoryInfo = resource.category ? categoryMeta[resource.category] : undefined;
            const CategoryIcon = categoryInfo?.icon || Tag;

            return (
              <div key={resource.id} className="card overflow-hidden flex flex-col">
                {resource.preview_url ? (
                  <div className="aspect-[4/3] bg-cream-200">
                    <img
                      src={resource.preview_url}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] bg-cream-200 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                      <FileIcon className="w-7 h-7 text-bark-500" />
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-bark-500">{resource.title}</h3>
                      <p className="text-sm text-bark-500/70 mt-1 line-clamp-2">
                        {resource.description || 'Practical, retail-ready support for your team.'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200 text-xs font-semibold text-bark-500">
                      <CategoryIcon className="w-3.5 h-3.5" />
                      {resource.category || 'Resource'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-bark-500/70">
                    <span className="flex items-center gap-2">
                      <FileIcon className="w-4 h-4" />
                      {resource.file_name || resource.file_type || 'Document'}
                    </span>
                    <span>{formatFileSize(resource.file_size)}</span>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary flex-1 text-sm"
                      download
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary flex-1 text-sm"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Open
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
