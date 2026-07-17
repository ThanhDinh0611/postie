import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { type Area } from 'react-easy-crop';
import {
  getPosts,
  getPostComments,
  createPostComment,
  generateComment,
  uploadImage,
  type PostData,
  type CampaignData,
  type PageData,
  type CommentData
} from '../api.ts';
import { useToast } from '../hooks/useToast.tsx';
import { compressImage, getCroppedImg } from '../utils/image.ts';
import ImageCropperModal from './ImageCropperModal.tsx';

interface PostHistoryProps {
  initialPosts?: PostData[];
  pages?: PageData[];
  campaigns?: CampaignData[];
  onRefresh?: () => void;
}

export default function PostHistory({ initialPosts, pages = [], campaigns = [], onRefresh }: PostHistoryProps) {
  const { getToken } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<PostData[]>(initialPosts ?? []);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [pageFilter, setPageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Comments & AI Assist states
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [showAiAssist, setShowAiAssist] = useState(false);
  const [useClipy, setUseClipy] = useState(false);
  const [commentTargetUrl, setCommentTargetUrl] = useState('https://google.com');
  const [commentLinkTitle, setCommentLinkTitle] = useState('');
  const [commentLinkDescription, setCommentLinkDescription] = useState('');
  const [generatingComment, setGeneratingComment] = useState(false);

  // Image attachments & cropping for comments
  const [commentAttachedFile, setCommentAttachedFile] = useState<File | null>(null);
  const [commentAttachedImage, setCommentAttachedImage] = useState<string | null>(null);

  // Cropper states
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(1);

  const handleImageSelect = (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setCropperSrc(localUrl);
    setCropperFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectRatio(1.91); // Facebook Link Preview ratio
  };

  const handleCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropConfirm = async () => {
    if (!cropperSrc || !croppedAreaPixels || !cropperFile) return;
    setLoadingComments(true);
    try {
      const croppedBlob = await getCroppedImg(cropperSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], cropperFile.name, { type: 'image/jpeg' });
      
      const compressedFile = await compressImage(croppedFile);
      
      setCommentAttachedFile(compressedFile);
      setCommentAttachedImage(URL.createObjectURL(compressedFile));
      
      setCropperSrc('');
      setCropperFile(null);
      setCroppedAreaPixels(null);
    } catch (err) {
      addToast('Lỗi cắt ảnh: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCropCancel = () => {
    setCropperSrc('');
    setCropperFile(null);
    setCroppedAreaPixels(null);
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getPostComments(postId, token);
      setComments(data.comments || []);
    } catch (err) {
      addToast('Không thể tải bình luận từ Facebook.', 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = (postId: string) => {
    setCommentAttachedFile(null);
    setCommentAttachedImage(null);
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setComments([]);
      setShowAiAssist(false);
    } else {
      setExpandedPostId(postId);
      setNewCommentText('');
      setShowAiAssist(false);
      fetchComments(postId);
    }
  };

  const handlePostComment = async (postId: string) => {
    if (!newCommentText.trim()) return;
    setPostingComment(true);
    try {
      const token = await getToken();
      if (!token) return;

      await createPostComment(postId, newCommentText, token);
      addToast('Đã đăng bình luận thành công! 💬', 'success');
      setNewCommentText('');
      setCommentAttachedFile(null);
      setCommentAttachedImage(null);
      fetchComments(postId);
    } catch (err) {
      addToast(`Lỗi đăng bình luận: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleGenerateComment = async (postId: string) => {
    setGeneratingComment(true);
    try {
      const token = await getToken();
      if (!token) return;

      let imageUrl: string | undefined;
      if (commentAttachedFile) {
        const uploadRes = await uploadImage(commentAttachedFile, token);
        imageUrl = uploadRes.image_url;
      }

      const result = await generateComment(postId, {
        useClipy,
        targetUrl: useClipy ? commentTargetUrl : undefined,
        linkTitle: useClipy ? commentLinkTitle : undefined,
        linkDescription: useClipy ? commentLinkDescription : undefined,
        imageUrl,
      }, token);
      setNewCommentText(result.comment);
      addToast('Tạo bình luận AI thành công! 🤖', 'success');
    } catch (err) {
      addToast(`Lỗi tạo bình luận AI: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setGeneratingComment(false);
    }
  };

  // Set default page filter to the active page once pages are loaded
  useEffect(() => {
    if (pages.length > 0 && pageFilter === 'all') {
      const active = pages.find(p => p.is_active);
      if (active) {
        setPageFilter(active.id);
      }
    }
  }, [pages]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const fetchedPosts = await getPosts(token, {
        pageId: pageFilter === 'all' ? undefined : pageFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        campaignId: campaignFilter === 'all' ? undefined : campaignFilter,
        sortBy: sortBy
      });
      setPosts(fetchedPosts);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, pageFilter, statusFilter, campaignFilter, sortBy]);

  // Refetch when filters/sort change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => { if (initialPosts) setPosts(initialPosts); }, [initialPosts]);

  const handleCopyLink = async (permalink: string) => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyFeedback(permalink);
      setTimeout(() => setCopyFeedback(null), 2000);
      addToast('📋 Đã sao chép liên kết vào khay nhớ tạm!', 'success');
    } catch {
      addToast('Không thể sao chép liên kết.', 'error');
    }
  };

  const handleRefresh = () => { fetchData(); if (onRefresh) onRefresh(); };

  const formatNumber = (n?: number): string => {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return '---';
    return new Date(ts * 1000).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { Published: '#22c55e', Scheduled: '#f59e0b', Draft: '#64748b', Failed: '#ef4444' };
    const bgColors: Record<string, string> = { Published: 'rgba(34,197,94,0.12)', Scheduled: 'rgba(245,158,11,0.12)', Draft: 'rgba(100,116,139,0.12)', Failed: 'rgba(239,68,68,0.12)' };
    const labels: Record<string, string> = { Published: 'Đã đăng', Scheduled: 'Lên lịch', Draft: 'Bản nháp', Failed: 'Lỗi' };
    return (
      <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: colors[status] ?? '#64748b', background: bgColors[status] ?? 'rgba(100,116,139,0.12)' }}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div>
      {/* Filters and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Danh sách bài đăng</h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Page Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={pageFilter}
            onChange={e => setPageFilter(e.target.value)}
          >
            <option value="all">Tất cả trang</option>
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_active ? '★' : ''}
              </option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
          >
            <option value="all">Tất cả chiến dịch</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Trạng thái (Tất cả)</option>
            <option value="Published">Đã đăng</option>
            <option value="Scheduled">Lên lịch</option>
            <option value="Draft">Bản nháp</option>
            <option value="Failed">Lỗi</option>
          </select>

          {/* Sorting Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '0.82rem', padding: '0.3rem 0.5rem' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="latest">Mới nhất</option>
            <option value="engagement">Tương tác cao nhất</option>
            <option value="likes">Yêu thích nhất</option>
            <option value="comments">Bình luận nhiều nhất</option>
            <option value="shares">Chia sẻ nhiều nhất</option>
            <option value="views">Lượt xem nhiều nhất</option>
          </select>
          <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
        </div>
      </div>

      {loading && posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Đang tải lịch sử bài viết...</div>
      ) : posts.length === 0 ? (
        <div className="placeholder-card"><p>Chưa có bài viết nào khớp với bộ lọc.</p></div>
      ) : (
        <div className="link-list">
          {posts.map(post => (
            <div key={post.id} className="link-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="link-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {post.message?.slice(0, 200)}{(post.message?.length ?? 0) > 200 ? '...' : ''}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                  {getStatusBadge(post.status)}
                  {post.post_format && post.post_format !== 'Post' ? (
                    <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                      {post.post_format}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Campaign & Engagement Metrics Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {post.page_name ?? 'Unknown'} - {formatDate(post.published_at ?? post.created_at)}
                  </span>
                  {post.campaign_title && (
                    <span className="campaign-tag" style={{ backgroundColor: post.campaign_color + '12', color: post.campaign_color, borderColor: post.campaign_color + '40', border: '1px solid' }}>
                      📁 {post.campaign_title}
                    </span>
                  )}
                </div>

                {/* Likes, Comments, Shares, Views */}
                {post.status === 'Published' && (
                  <div style={{ display: 'flex', gap: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    <span title="Lượt thích">❤️ {formatNumber(post.likes)}</span>
                    <span title="Bình luận">💬 {formatNumber(post.comments_count)}</span>
                    <span title="Chia sẻ">🔁 {formatNumber(post.shares)}</span>
                    <span title="Lượt xem" style={{ color: 'var(--text-muted)' }}>👁️ {formatNumber(post.views)}</span>
                  </div>
                )}

                {post.permalink ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-sm" onClick={() => handleCopyLink(post.permalink!)}
                      style={copyFeedback === post.permalink ? { borderColor: 'var(--success)' } : {}}>
                      {copyFeedback === post.permalink ? 'Copied!' : 'Copy'}
                    </button>
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">Open</a>
                    {post.status === 'Published' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleToggleComments(post.id)}
                        style={expandedPostId === post.id ? { background: 'var(--primary)', color: '#000', borderColor: 'var(--primary)' } : {}}
                      >
                        💬 {expandedPostId === post.id ? 'Đóng' : 'Bình luận'}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Expanded Comments Section */}
              {expandedPostId === post.id && (
                <div className="comments-section">
                  <div className="comments-title">
                    <span>💬 Bình luận của trang ({comments.length})</span>
                    <button className="btn btn-sm" onClick={() => fetchComments(post.id)} disabled={loadingComments}>
                      🔄 {loadingComments ? 'Đang tải...' : 'Làm mới'}
                    </button>
                  </div>

                  {loadingComments && comments.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Đang tải bình luận...
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Chưa có bình luận nào trên bài viết này.
                    </div>
                  ) : (
                    <div className="comments-list">
                      {comments.map((c) => (
                        <div key={c.id} className="comment-item">
                          <div className="comment-header">
                            <span className="comment-author">👤 {c.from_name || 'Người dùng Facebook'}</span>
                            {c.created_time && (
                              <span className="comment-date">
                                {new Date(c.created_time * 1000).toLocaleString('vi-VN')}
                              </span>
                            )}
                          </div>
                          <div className="comment-content">{c.message}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Form */}
                  <div className="comment-form">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Viết bình luận mới
                      </label>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        onClick={() => setShowAiAssist(!showAiAssist)}
                      >
                        🪄 AI Trợ lý bình luận
                      </button>
                    </div>

                    {/* AI Assist Drawer */}
                    {showAiAssist && (
                      <div className="ai-assist-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="commentUseClipy"
                            checked={useClipy}
                            onChange={(e) => setUseClipy(e.target.checked)}
                          />
                          <label htmlFor="commentUseClipy" style={{ fontSize: '0.75rem', fontWeight: 600, userSelect: 'none' }}>
                            Đính kèm link rút gọn Clipy
                          </label>
                        </div>

                        {useClipy && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <input
                                type="url"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                                placeholder="Link đích (ví dụ: https://shopee.vn/...)"
                                value={commentTargetUrl}
                                onChange={(e) => setCommentTargetUrl(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                                placeholder="Tiêu đề link (không bắt buộc)"
                                value={commentLinkTitle}
                                onChange={(e) => setCommentLinkTitle(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                                placeholder="Mô tả link (không bắt buộc)"
                                value={commentLinkDescription}
                                onChange={(e) => setCommentLinkDescription(e.target.value)}
                              />
                            </div>

                            {/* Link preview image picker */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                              <input
                                type="file"
                                id={`commentImage-${post.id}`}
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageSelect(file);
                                }}
                              />
                              <label
                                htmlFor={`commentImage-${post.id}`}
                                className="btn btn-sm"
                                style={{ cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.5rem', marginBottom: 0 }}
                              >
                                🖼️ Chọn ảnh xem trước cho link
                              </label>

                              {commentAttachedImage && (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <img
                                    src={commentAttachedImage}
                                    alt="Link preview OG"
                                    style={{ maxHeight: '32px', borderRadius: '2px', border: '1px solid var(--border)' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCommentAttachedFile(null);
                                      setCommentAttachedImage(null);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: '-4px',
                                      right: '-4px',
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: '#ef4444',
                                      color: '#fff',
                                      border: 'none',
                                      fontSize: '7px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleGenerateComment(post.id)}
                          disabled={generatingComment || (useClipy && !commentTargetUrl)}
                          style={{ alignSelf: 'flex-start', fontSize: '0.72rem', marginTop: '0.25rem' }}
                        >
                          {generatingComment ? '🤖 Đang tạo bình luận...' : '🤖 Viết bình luận bằng AI'}
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      className="form-control"
                      placeholder="Nhập nội dung bình luận của bạn tại đây..."
                      style={{ fontSize: '0.82rem', resize: 'vertical' }}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      disabled={postingComment}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handlePostComment(post.id)}
                        disabled={postingComment || !newCommentText.trim()}
                      >
                        {postingComment ? 'Đang gửi...' : 'Gửi bình luận 🚀'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Global Image Cropper Modal for Comments */}
      {cropperSrc && (
        <ImageCropperModal
          cropperSrc={cropperSrc}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          allowRatioSelection={false}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}