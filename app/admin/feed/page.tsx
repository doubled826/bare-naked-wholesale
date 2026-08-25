'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertCircle, Award, CheckCircle2, Heart, ImagePlus, MessageCircle, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

export default function AdminFeedPage() {
  const supabase = createClientComponentClient();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>({});
  const [likesByTarget, setLikesByTarget] = useState<Record<string, FeedLike[]>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);
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
  const [deletingPosts, setDeletingPosts] = useState<Record<string, boolean>>({});
  const [deletingComments, setDeletingComments] = useState<Record<string, boolean>>({});

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
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id ?? null;
      setCurrentUserId(userId);
      if (!userId) return;
      supabase
        .from('admin_users')
        .select('avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data: adminUser }) => {
          setAdminAvatarUrl(adminUser?.avatar_url ?? null);
        });
    });
  }, [supabase]);

  useEffect(() => {
    const postsChannel = supabase
      .channel('admin-feed-posts')
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
      .channel('admin-feed-comments')
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
    if ((!postBody.trim() && !postImageFile) || isSubmittingPost) return;

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
          retailer_id: null,
          author_name: 'Bare Naked Team',
          author_avatar_url: adminAvatarUrl,
          is_admin: true,
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

  const handleDeletePost = async (postId: string) => {
    if (deletingPosts[postId]) return;
    setDeletingPosts((current) => ({ ...current, [postId]: true }));

    const { error } = await supabase.from('feed_posts').delete().eq('id', postId);

    if (!error) {
      setPosts((current) => current.filter((post) => post.id !== postId));
      setCommentsByPost((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    }

    setDeletingPosts((current) => ({ ...current, [postId]: false }));
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (deletingComments[commentId]) return;
    setDeletingComments((current) => ({ ...current, [commentId]: true }));

    const { error } = await supabase.from('feed_comments').delete().eq('id', commentId);

    if (!error) {
      setCommentsByPost((current) => {
        const list = current[postId] || [];
        return { ...current, [postId]: list.filter((comment) => comment.id !== commentId) };
      });
    }

    setDeletingComments((current) => ({ ...current, [commentId]: false }));
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
    if ((!body && !replyImage) || submittingReplies[postId]) return;

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
          retailer_id: null,
          author_name: 'Bare Naked Team',
          author_avatar_url: adminAvatarUrl,
          is_admin: true,
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
        retailer_id: null,
        is_admin: true,
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
      <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-200 rounded-full" />
          <div className="h-3 w-11/12 bg-gray-200 rounded-full" />
          <div className="h-3 w-9/12 bg-gray-200 rounded-full" />
        </div>
        <div className="h-3 w-24 bg-gray-200 rounded-full" />
      </div>
    ));
  }, []);

  const emptyState = useMemo(() => {
    if (loading || posts.length > 0) return null;
    return (
      <div className="flex flex-col items-center justify-center text-center py-14 text-gray-600">
        <div className="w-12 h-12 rounded-2xl bg-bark-100 flex items-center justify-center mb-4">
          <MessageCircle className="w-6 h-6 text-bark-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">The community is just getting started</h3>
        <p className="max-w-md mt-2 text-sm">
          Be the first to post — share a tip, introduce your store, or ask something you've been wondering about.
        </p>
      </div>
    );
  }, [loading, posts.length]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Community Feed
            </h1>
            <p className="text-sm text-gray-600">
              A space for Bare Naked retailers to connect, share what's working, and learn from each other.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bark-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-bark-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--font-poppins)' }}>
              Post as Bare Naked Team
            </h2>
            <p className="text-sm text-gray-600">Share updates, tips, and announcements.</p>
          </div>
        </div>
        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-bark-500 text-white flex items-center justify-center font-semibold text-sm overflow-hidden">
              {adminAvatarUrl ? (
                <img src={adminAvatarUrl} alt="Admin logo" className="w-full h-full object-contain bg-white" />
              ) : (
                'BN'
              )}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-bark-500 focus:ring-4 focus:ring-bark-500/10 transition-all duration-200 min-h-[140px]"
                placeholder="Share an update with the community..."
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
              />
              {postImagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  <img
                    src={postImagePreview}
                    alt="Post upload preview"
                    className="w-full max-h-[420px] object-contain bg-gray-100 cursor-zoom-in"
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
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-bark-500 hover:text-bark-600 hover:bg-bark-100 transition-colors">
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
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bark-500 text-white font-semibold rounded-xl shadow-lg shadow-bark-500/20 hover:bg-bark-600 transition-colors disabled:opacity-50"
                  disabled={(!postBody.trim() && !postImageFile) || isSubmittingPost}
                >
                  <Send className="w-4 h-4" />
                  Share Update
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {postStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4" />
                Shared! Retailers will see this right away.
              </div>
            )}
            {postStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4" />
                {postError}
              </div>
            )}
          </div>
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
                        'rounded-full flex items-center justify-center font-semibold text-bark-500 bg-bark-100 overflow-hidden',
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
                        <p className="text-xs font-semibold text-gray-800">{comment.author_name}</p>
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
                        <span className="text-[11px] text-gray-500">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      {comment.image_url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-white">
                          <img
                            src={comment.image_url}
                            alt="Reply upload"
                            className="w-full max-h-72 object-contain bg-gray-100 cursor-zoom-in"
                            onClick={() => setLightboxImage(comment.image_url || null)}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <button
                          type="button"
                          onClick={() => toggleLike('comment', comment.id)}
                          className={cn(
                            'inline-flex items-center gap-1 text-bark-500 hover:text-bark-600',
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
                          className="text-bark-500 font-medium hover:text-bark-600"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id, post.id)}
                      className={cn(
                        'inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors',
                        deletingComments[comment.id] && 'opacity-50'
                      )}
                      aria-label="Delete comment"
                      disabled={deletingComments[comment.id]}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {renderCommentThread(comment.id, depth + 1)}
                </div>
              );
            });
          };

          return (
            <div
              key={post.id}
              className={cn(
                'bg-white border border-gray-200 rounded-2xl p-6 space-y-4',
                post.is_admin && 'border-bark-200 bg-bark-50/40'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-bark-100 flex items-center justify-center text-bark-500 text-sm font-semibold overflow-hidden">
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
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{post.author_name}</p>
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
                    <span className="text-xs text-gray-500">{timeAgo(post.created_at)}</span>
                  </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePost(post.id)}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors',
                    deletingPosts[post.id] && 'opacity-50'
                  )}
                  aria-label="Delete post"
                  disabled={deletingPosts[post.id]}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
              {post.image_url && (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  <img
                    src={post.image_url}
                    alt="Post upload"
                    className="w-full max-h-[520px] object-contain bg-gray-100 cursor-zoom-in"
                    onClick={() => setLightboxImage(post.image_url || null)}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <button
                  type="button"
                  onClick={() => toggleReplies(post.id)}
                  className="text-bark-500 font-medium hover:text-bark-600"
                >
                  {commentLabel}
                </button>
                <button
                  type="button"
                  onClick={() => toggleLike('post', post.id)}
                  className={cn('text-bark-500 font-medium hover:text-bark-600 inline-flex items-center gap-1', postLike.hasLiked && 'text-red-500')}
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
                  className="text-bark-500 font-medium hover:text-bark-600"
                >
                  {isExpanded ? 'Hide replies' : 'Reply'}
                </button>
              </div>

              {isExpanded && (
                <div className="pt-2 border-t border-gray-200 space-y-4">
                  <div className="space-y-3">
                    {renderCommentThread(null, 0)}
                  </div>

                  <div className="space-y-2">
                    {replyTargets[post.id] && (
                      <div className="text-xs text-gray-500">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-bark-500 focus:ring-4 focus:ring-bark-500/10 transition-all duration-200 min-h-[90px]"
                      placeholder="Add a reply..."
                      value={replyBodies[post.id] || ''}
                      onChange={(event) =>
                        setReplyBodies((current) => ({ ...current, [post.id]: event.target.value }))
                      }
                    />
                    {replyImagePreviews[post.id] && (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                        <img
                          src={replyImagePreviews[post.id] || ''}
                          alt="Reply upload preview"
                          className="w-full max-h-56 object-contain bg-gray-100 cursor-zoom-in"
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
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-bark-500 hover:text-bark-600 hover:bg-bark-100 transition-colors">
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
                        className={cn(
                          'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-bark-500 text-white hover:bg-bark-600 transition-colors',
                          submittingReplies[post.id] && 'opacity-60'
                        )}
                        disabled={(!replyBodies[post.id]?.trim() && !replyImageFiles[post.id]) || submittingReplies[post.id]}
                      >
                        Post Reply
                      </button>
                      <span className="text-xs text-gray-500">Posted as Bare Naked Team</span>
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
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
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
