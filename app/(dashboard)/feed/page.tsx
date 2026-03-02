'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertCircle, Award, CheckCircle2, Heart, ImagePlus, MessageCircle, MessageSquare, Send, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface FeedPost {
  id: string;
  retailer_id: string | null;
  author_name: string;
  author_avatar_url?: string | null;
  is_admin: boolean;
  body: string;
  image_url?: string | null;
  created_at: string;
}

interface FeedComment {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  retailer_id: string | null;
  author_name: string;
  author_avatar_url?: string | null;
  is_admin: boolean;
  body: string;
  image_url?: string | null;
  created_at: string;
}

interface FeedLike {
  id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  user_id: string;
}

export default function FeedPage() {
  const supabase = createClientComponentClient();
  const { retailer } = useAppStore();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>({});
  const [likesByTarget, setLikesByTarget] = useState<Record<string, FeedLike[]>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [retailerLogos, setRetailerLogos] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [topRetailerIds, setTopRetailerIds] = useState<Set<string>>(new Set());
  const [postBody, setPostBody] = useState('');
  const [postStatus, setPostStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [postError, setPostError] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [submittingReplies, setSubmittingReplies] = useState<Record<string, boolean>>({});
  const [replyImageFiles, setReplyImageFiles] = useState<Record<string, File | null>>({});
  const [replyImagePreviews, setReplyImagePreviews] = useState<Record<string, string | null>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, string | null>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const addCommentToPost = (postId: string, comment: FeedComment) => {
    setCommentsByPost((current) => {
      const list = current[postId] || [];
      if (list.some((item) => item.id === comment.id)) return current;
      const next = [...list, comment].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return { ...current, [postId]: next };
    });
  };

  const businessName = retailer?.company_name || retailer?.business_name || 'Retailer';

  const uploadImage = async (file: File, folder: string) => {
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('feed-media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('feed-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const loadFeed = async () => {
    setLoading(true);
    const { data: postData } = await supabase
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false });

    const postsList = (postData || []) as FeedPost[];
    setPosts(postsList);

    if (postsList.length === 0) {
      setCommentsByPost({});
      setLikesByTarget({});
      setLoading(false);
      return;
    }

    const postIds = postsList.map((post) => post.id);
    const { data: commentData } = await supabase
      .from('feed_comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    const grouped: Record<string, FeedComment[]> = {};
    (commentData || []).forEach((comment) => {
      if (!grouped[comment.post_id]) {
        grouped[comment.post_id] = [];
      }
      grouped[comment.post_id].push(comment as FeedComment);
    });

    setCommentsByPost(grouped);

    const retailerIds = Array.from(new Set([
      ...postsList.map((post) => post.retailer_id).filter(Boolean),
      ...((commentData || []) as FeedComment[]).map((comment) => comment.retailer_id).filter(Boolean),
    ])) as string[];

    if (retailerIds.length > 0) {
      const { data: logoData } = await supabase
        .from('retailers')
        .select('id, logo_url')
        .in('id', retailerIds);
      const logoMap: Record<string, string | null> = {};
      (logoData || []).forEach((row) => {
        logoMap[row.id] = row.logo_url ?? null;
      });
      setRetailerLogos(logoMap);
    } else {
      setRetailerLogos({});
    }

    const commentIds = ((commentData || []) as FeedComment[]).map((comment) => comment.id);
    const { data: likeData } = await supabase
      .from('feed_likes')
      .select('id, target_type, target_id, user_id')
      .in('target_id', [...postIds, ...commentIds]);

    const likeMap: Record<string, FeedLike[]> = {};
    (likeData || []).forEach((like) => {
      const key = `${like.target_type}:${like.target_id}`;
      if (!likeMap[key]) likeMap[key] = [];
      likeMap[key].push(like as FeedLike);
    });
    setLikesByTarget(likeMap);
    setLoading(false);
  };

  const loadTopRetailers = async () => {
    const { data } = await supabase.rpc('get_top_retailers_by_revenue', { limit_count: 10 });
    const topTen = (data || []).map((row: { retailer_id: string }) => row.retailer_id);
    setTopRetailerIds(new Set(topTen));
  };

  useEffect(() => {
    loadFeed();
    loadTopRetailers();
  }, []);

  useEffect(() => {
    if (!retailer?.id) return;
    supabase
      .from('feed_reads')
      .upsert({ retailer_id: retailer.id, last_read_at: new Date().toISOString() }, { onConflict: 'retailer_id' });
  }, [supabase, retailer?.id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    const postsChannel = supabase
      .channel('feed-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_posts' }, (payload) => {
        const incoming = payload.new as FeedPost;
        setPosts((current) => (current.some((post) => post.id === incoming.id) ? current : [incoming, ...current]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'feed_posts' }, (payload) => {
        const removed = payload.old as { id: string };
        setPosts((current) => current.filter((post) => post.id !== removed.id));
        setCommentsByPost((current) => {
          const next = { ...current };
          delete next[removed.id];
          return next;
        });
      })
      .subscribe();

    const commentsChannel = supabase
      .channel('feed-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_comments' }, (payload) => {
        const incoming = payload.new as FeedComment;
        addCommentToPost(incoming.post_id, incoming);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'feed_comments' }, (payload) => {
        const removed = payload.old as FeedComment;
        setCommentsByPost((current) => {
          const list = current[removed.post_id] || [];
          return { ...current, [removed.post_id]: list.filter((comment) => comment.id !== removed.id) };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [supabase]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadTopRetailers();
    }, 2 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (postStatus !== 'success') return;
    const timeout = window.setTimeout(() => setPostStatus('idle'), 2400);
    return () => window.clearTimeout(timeout);
  }, [postStatus]);

  useEffect(() => {
    if (!postImagePreview) return;
    return () => URL.revokeObjectURL(postImagePreview);
  }, [postImagePreview]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImage]);

  const handlePostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!postBody.trim() && !postImageFile) || !retailer?.id || isSubmittingPost) return;

    setIsSubmittingPost(true);
    setPostStatus('idle');
    setPostError('');

    try {
      let imageUrl: string | null = null;
      if (postImageFile) {
        imageUrl = await uploadImage(postImageFile, 'posts');
      }

      const { data, error } = await supabase
        .from('feed_posts')
        .insert({
          retailer_id: retailer.id,
          author_name: businessName,
          author_avatar_url: retailer?.logo_url || null,
          is_admin: false,
          body: postBody.trim(),
          image_url: imageUrl,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setPosts((current) => (current.some((post) => post.id === data.id) ? current : [data as FeedPost, ...current]));
      }

      setPostBody('');
      if (postImagePreview) {
        URL.revokeObjectURL(postImagePreview);
      }
      setPostImageFile(null);
      setPostImagePreview(null);
      setPostStatus('success');
    } catch (error) {
      setPostStatus('error');
      setPostError(error instanceof Error ? error.message : 'Unable to share your post right now.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const toggleReplies = (postId: string) => {
    setExpandedPosts((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleReplySubmit = async (postId: string) => {
    const body = replyBodies[postId]?.trim();
    const replyImage = replyImageFiles[postId];
    if ((!body && !replyImage) || !retailer?.id || submittingReplies[postId]) return;

    setSubmittingReplies((current) => ({ ...current, [postId]: true }));

    try {
      let imageUrl: string | null = null;
      if (replyImage) {
        imageUrl = await uploadImage(replyImage, 'replies');
      }

      const { data, error } = await supabase
        .from('feed_comments')
        .insert({
          post_id: postId,
          parent_comment_id: replyTargets[postId] || null,
          retailer_id: retailer.id,
          author_name: businessName,
          author_avatar_url: retailer?.logo_url || null,
          is_admin: false,
          body,
          image_url: imageUrl,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        addCommentToPost(postId, data as FeedComment);
      }

      setReplyBodies((current) => ({ ...current, [postId]: '' }));
      const existingPreview = replyImagePreviews[postId];
      if (existingPreview) {
        URL.revokeObjectURL(existingPreview);
      }
      setReplyImageFiles((current) => ({ ...current, [postId]: null }));
      setReplyImagePreviews((current) => ({ ...current, [postId]: null }));
      setReplyTargets((current) => ({ ...current, [postId]: null }));
      setExpandedPosts((current) => new Set(current).add(postId));
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      setSubmittingReplies((current) => ({ ...current, [postId]: false }));
    }
  };

  const toggleLike = async (targetType: 'post' | 'comment', targetId: string) => {
    if (!currentUserId) return;
    const key = `${targetType}:${targetId}`;
    const existing = likesByTarget[key]?.find((like) => like.user_id === currentUserId);

    if (existing) {
      const { error } = await supabase.from('feed_likes').delete().eq('id', existing.id);
      if (error) return;
      setLikesByTarget((current) => ({
        ...current,
        [key]: (current[key] || []).filter((like) => like.id !== existing.id),
      }));
      return;
    }

    const { data, error } = await supabase
      .from('feed_likes')
      .insert({
        target_type: targetType,
        target_id: targetId,
        user_id: currentUserId,
        retailer_id: retailer?.id || null,
        is_admin: false,
      })
      .select('id, target_type, target_id, user_id')
      .single();

    if (error || !data) return;
    setLikesByTarget((current) => ({
      ...current,
      [key]: [...(current[key] || []), data as FeedLike],
    }));
  };

  const getLikeMeta = (targetType: 'post' | 'comment', targetId: string) => {
    const key = `${targetType}:${targetId}`;
    const likes = likesByTarget[key] || [];
    const hasLiked = !!currentUserId && likes.some((like) => like.user_id === currentUserId);
    return { count: likes.length, hasLiked };
  };

  const getAuthorAvatar = (retailerId: string | null | undefined, fallback?: string | null) => {
    if (retailerId && retailerLogos[retailerId]) return retailerLogos[retailerId];
    return fallback ?? null;
  };

  const timeAgo = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true });

  const skeletonCards = useMemo(() => {
    return Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="card p-6 space-y-4 animate-pulse">
        <div className="h-4 w-40 bg-cream-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-cream-200 rounded-full" />
          <div className="h-3 w-11/12 bg-cream-200 rounded-full" />
          <div className="h-3 w-9/12 bg-cream-200 rounded-full" />
        </div>
        <div className="h-3 w-24 bg-cream-200 rounded-full" />
      </div>
    ));
  }, []);

  const emptyState = useMemo(() => {
    if (loading || posts.length > 0) return null;
    return (
      <div className="flex flex-col items-center justify-center text-center py-14 text-bark-500/70">
        <div className="w-12 h-12 rounded-2xl bg-cream-200 flex items-center justify-center mb-4">
          <MessageCircle className="w-6 h-6 text-bark-500" />
        </div>
        <h3 className="text-lg font-semibold text-bark-500">The community is just getting started</h3>
        <p className="max-w-md mt-2 text-sm">
          Be the first to post — share a tip, introduce your store, or ask something you've been wondering about.
        </p>
      </div>
    );
  }, [loading, posts.length]);

  return (
    <div className="p-6 lg:px-10 lg:py-8 max-w-4xl mx-auto space-y-6">
      <div className="card relative overflow-hidden p-6 lg:p-8">
        <div className="absolute inset-0 pattern-dots opacity-40" />
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-bark-500/10 blur-3xl" />
        <div className="relative z-10 space-y-3">
          <p className="text-sm font-semibold text-bark-500/70 tracking-wide uppercase">Community Feed</p>
          <h1 className="page-title">A place to learn from each other</h1>
          <p className="text-bark-500/70 max-w-2xl">
            A space for Bare Naked retailers to connect, share what's working, and learn from each other.
          </p>
        </div>
      </div>

      <div className="card p-6 lg:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h2 className="section-title">Share with the community</h2>
            <p className="text-sm text-bark-500/70">Your insights help every retailer grow.</p>
          </div>
        </div>
        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-bark-500 text-white flex items-center justify-center font-semibold text-sm overflow-hidden">
              {retailer?.logo_url ? (
                <img src={retailer.logo_url} alt="Store logo" className="w-full h-full object-contain bg-white" />
              ) : (
                businessName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                className="input min-h-[140px]"
                placeholder="Share a tip, ask a question, or tell us what's working in your store..."
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
              />
              {postImagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-cream-200 bg-white">
                  <img
                    src={postImagePreview}
                    alt="Post upload preview"
                    className="w-full max-h-[420px] object-contain bg-cream-200/40 cursor-zoom-in"
                    onClick={() => setLightboxImage(postImagePreview)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (postImagePreview) {
                        URL.revokeObjectURL(postImagePreview);
                      }
                      setPostImageFile(null);
                      setPostImagePreview(null);
                    }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-bark-500 flex items-center justify-center shadow"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn-ghost px-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (postImagePreview) {
                        URL.revokeObjectURL(postImagePreview);
                      }
                      setPostImageFile(file);
                      setPostImagePreview(URL.createObjectURL(file));
                    }}
                  />
                  <ImagePlus className="w-4 h-4" />
                  Add Photo
                </label>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={(!postBody.trim() && !postImageFile) || isSubmittingPost}
                >
                  <Send className="w-4 h-4" />
                  Share with the Community
                </button>
              </div>
            </div>
          </div>
          {postStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Shared! Thanks for helping the community.
            </div>
          )}
          {postStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              {postError}
            </div>
          )}
        </form>
      </div>

      <div className="space-y-4">
        {loading && skeletonCards}
        {emptyState}
        {posts.map((post) => {
          const comments = commentsByPost[post.id] || [];
          const isExpanded = expandedPosts.has(post.id);
          const commentCount = comments.length;
          const commentLabel = commentCount === 0 ? 'No replies yet' : `${commentCount} ${commentCount === 1 ? 'reply' : 'replies'}`;
          const postLike = getLikeMeta('post', post.id);
          const commentsByParent = comments.reduce<Record<string, FeedComment[]>>((acc, comment) => {
            const key = comment.parent_comment_id ?? 'root';
            if (!acc[key]) acc[key] = [];
            acc[key].push(comment);
            return acc;
          }, {});
          const renderCommentThread = (parentId: string | null, depth: number) => {
            const key = parentId ?? 'root';
            const items = commentsByParent[key] || [];
            return items.map((comment) => {
              const commentLike = getLikeMeta('comment', comment.id);
              const isNested = depth > 0;
              return (
                <div key={comment.id} className="space-y-3" style={{ marginLeft: depth * 24 }}>
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        'rounded-full flex items-center justify-center font-semibold text-bark-500 bg-cream-200 overflow-hidden',
                        isNested ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-[11px]'
                      )}
                    >
                      {getAuthorAvatar(comment.retailer_id, comment.author_avatar_url) ? (
                        <img
                          src={getAuthorAvatar(comment.retailer_id, comment.author_avatar_url) || ''}
                          alt={`${comment.author_name} logo`}
                          className="w-full h-full object-contain bg-white"
                        />
                      ) : (
                        comment.author_name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-bark-500">{comment.author_name}</p>
                        {comment.retailer_id && topRetailerIds.has(comment.retailer_id) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <Award className="w-3 h-3" />
                            Top Retailer 🏆
                          </span>
                        )}
                        {comment.is_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bark-500 text-white">
                            Admin
                          </span>
                        )}
                        <span className="text-[11px] text-bark-500/60">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-bark-500/80 leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      {comment.image_url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-cream-200 bg-white">
                          <img
                            src={comment.image_url}
                            alt="Reply upload"
                            className="w-full max-h-72 object-contain bg-cream-200/40 cursor-zoom-in"
                            onClick={() => setLightboxImage(comment.image_url || null)}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-bark-500/70">
                        <button
                          type="button"
                          onClick={() => toggleLike('comment', comment.id)}
                          className={cn(
                            'btn-ghost px-0 text-bark-500 flex items-center gap-1',
                            commentLike.hasLiked && 'text-red-500'
                          )}
                        >
                          <Heart className={cn('w-3.5 h-3.5', commentLike.hasLiked && 'fill-current')} />
                          {commentLike.count}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTargets((current) => ({ ...current, [post.id]: comment.id }));
                            setExpandedPosts((current) => new Set(current).add(post.id));
                          }}
                          className="btn-ghost px-0 text-bark-500"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                  {renderCommentThread(comment.id, depth + 1)}
                </div>
              );
            });
          };

          return (
            <div key={post.id} className="card p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center text-bark-500 text-sm font-semibold overflow-hidden">
                  {getAuthorAvatar(post.retailer_id, post.author_avatar_url) ? (
                    <img
                      src={getAuthorAvatar(post.retailer_id, post.author_avatar_url) || ''}
                      alt={`${post.author_name} logo`}
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    post.author_name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-bark-500">{post.author_name}</p>
                    {post.retailer_id && topRetailerIds.has(post.retailer_id) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <Award className="w-3.5 h-3.5" />
                        Top Retailer 🏆
                      </span>
                    )}
                    {post.is_admin && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-bark-500 text-white">
                        Admin
                      </span>
                    )}
                    <span className="text-xs text-bark-500/60">{timeAgo(post.created_at)}</span>
                  </div>
                </div>
              </div>
              <p className="text-bark-500 text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
              {post.image_url && (
                <div className="rounded-2xl overflow-hidden border border-cream-200 bg-white">
                  <img
                    src={post.image_url}
                    alt="Post upload"
                    className="w-full max-h-[520px] object-contain bg-cream-200/40 cursor-zoom-in"
                    onClick={() => setLightboxImage(post.image_url || null)}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-bark-500/70">
                <button
                  type="button"
                  onClick={() => toggleReplies(post.id)}
                  className="btn-ghost px-0 text-bark-500"
                >
                  {commentLabel}
                </button>
                <button
                  type="button"
                  onClick={() => toggleLike('post', post.id)}
                  className={cn('btn-ghost px-0 text-bark-500 flex items-center gap-1', postLike.hasLiked && 'text-red-500')}
                >
                  <Heart className={cn('w-4 h-4', postLike.hasLiked && 'fill-current')} />
                  {postLike.count}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTargets((current) => ({ ...current, [post.id]: null }));
                    setExpandedPosts((current) => new Set(current).add(post.id));
                  }}
                  className="btn-ghost px-0 text-bark-500"
                >
                  {isExpanded ? 'Hide replies' : 'Reply'}
                </button>
              </div>

              {isExpanded && (
                <div className="pt-2 border-t border-cream-200 space-y-4">
                  <div className="space-y-3">
                    {renderCommentThread(null, 0)}
                  </div>

                  <div className="space-y-2">
                    {replyTargets[post.id] && (
                      <div className="text-xs text-bark-500/70">
                        Replying to a comment ·
                        <button
                          type="button"
                          onClick={() => setReplyTargets((current) => ({ ...current, [post.id]: null }))}
                          className="ml-2 text-bark-500 font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <textarea
                      className="input min-h-[90px]"
                      placeholder="Add a reply..."
                      value={replyBodies[post.id] || ''}
                      onChange={(event) =>
                        setReplyBodies((current) => ({ ...current, [post.id]: event.target.value }))
                      }
                    />
                    {replyImagePreviews[post.id] && (
                      <div className="relative rounded-xl overflow-hidden border border-cream-200 bg-white">
                        <img
                          src={replyImagePreviews[post.id] || ''}
                          alt="Reply upload preview"
                          className="w-full max-h-56 object-contain bg-cream-200/40 cursor-zoom-in"
                          onClick={() => setLightboxImage(replyImagePreviews[post.id] || null)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const existingPreview = replyImagePreviews[post.id];
                            if (existingPreview) {
                              URL.revokeObjectURL(existingPreview);
                            }
                            setReplyImageFiles((current) => ({ ...current, [post.id]: null }));
                            setReplyImagePreviews((current) => ({ ...current, [post.id]: null }));
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-bark-500 flex items-center justify-center shadow"
                          aria-label="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="btn-ghost px-3 text-sm">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const existingPreview = replyImagePreviews[post.id];
                            if (existingPreview) {
                              URL.revokeObjectURL(existingPreview);
                            }
                            setReplyImageFiles((current) => ({ ...current, [post.id]: file }));
                            setReplyImagePreviews((current) => ({
                              ...current,
                              [post.id]: URL.createObjectURL(file),
                            }));
                          }}
                        />
                        <ImagePlus className="w-4 h-4" />
                        Add Photo
                      </label>
                      <button
                        type="button"
                        onClick={() => handleReplySubmit(post.id)}
                        className={cn('btn-primary px-4 py-2 text-sm', submittingReplies[post.id] && 'opacity-60')}
                        disabled={(!replyBodies[post.id]?.trim() && !replyImageFiles[post.id]) || submittingReplies[post.id]}
                      >
                        Post Reply
                      </button>
                      <span className="text-xs text-bark-500/60">Posted as {businessName}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-bark-500/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxImage(null);
            }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/90 text-bark-500 flex items-center justify-center shadow"
            aria-label="Close image"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Expanded upload"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
