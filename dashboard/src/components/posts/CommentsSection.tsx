import { useState } from 'react';
import { usePosts } from '@/hooks/usePosts.ts';
import { useComments } from '@/hooks/useComments.ts';
import { useImageCropper } from '@/hooks/useImageCropper.ts';
import { useToast } from '@/hooks/useToast.tsx';
import { toErrorMessage } from '@/utils/errors.ts';
import ImageCropperModal from '@/components/ImageCropperModal.tsx';

interface CommentsSectionProps {
  postId: string;
  onClose: () => void;
}

export default function CommentsSection({ postId, onClose }: CommentsSectionProps) {
  const { addToast } = useToast();

  const { createCommentMutation, generateCommentMutation, uploadImageMutation, deleteCommentMutation } = usePosts();

  const { data, isLoading } = useComments(postId);
  const comments = data?.comments ?? [];
  const replies = data?.replies ?? [];

  const [newCommentText, setNewCommentText] = useState('');
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [useClipy, setUseClipy] = useState(false);
  const [commentTargetUrl, setCommentTargetUrl] = useState('https://google.com');
  const [commentLinkTitle, setCommentLinkTitle] = useState('');
  const [commentLinkDescription, setCommentLinkDescription] = useState('');

  const cropper = useImageCropper(1.91);

  const handlePostComment = async () => {
    if (!newCommentText.trim()) return;
    try {
      let finalMediaUrl: string | undefined = undefined;

      if (cropper.attachedFile) {
        const uploadRes = await uploadImageMutation.mutateAsync(cropper.attachedFile);
        finalMediaUrl = uploadRes.image_url;
      }

      await createCommentMutation.mutateAsync({ postId, message: newCommentText, attachmentUrl: finalMediaUrl });

      addToast('Đã đăng bình luận thành công! 💬', 'success');
      setNewCommentText('');
      cropper.clearAttached();
    } catch (err) {
      addToast(`Lỗi đăng bình luận: ${toErrorMessage(err)}`, 'error');
    }
  };

  const handleGenerateComment = async () => {
    try {
      let imageUrl: string | undefined = undefined;
      if (cropper.attachedFile) {
        const uploadRes = await uploadImageMutation.mutateAsync(cropper.attachedFile);
        imageUrl = uploadRes.image_url;
      }

      const result = await generateCommentMutation.mutateAsync({
        postId,
        params: { useClipy, targetUrl: useClipy ? commentTargetUrl : undefined, linkTitle: useClipy ? commentLinkTitle : undefined, linkDescription: useClipy ? commentLinkDescription : undefined, imageUrl }
      });

      setNewCommentText(result.comment);
      addToast('Tạo bình luận AI thành công! 🤖', 'success');
    } catch (err) {
      addToast(`Lỗi tạo bình luận AI: ${toErrorMessage(err)}`, 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({ postId, commentId });
      addToast('Đã xóa bình luận thành công!', 'success');
    } catch (err) {
      addToast(`Lỗi xóa bình luận: ${toErrorMessage(err)}`, 'error');
    }
  };

  const isWorking = createCommentMutation.isPending || generateCommentMutation.isPending || uploadImageMutation.isPending || deleteCommentMutation.isPending;

  return (
    <div className="comments-section" onClick={(e) => e.stopPropagation()}>
      <div className="comments-title">
        <span>💬 Bình luận của trang ({(comments.length ?? 0) + (replies.length ?? 0)})</span>
        <button className="btn btn-sm" onClick={onClose}>
          Đóng bình luận
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted" style={{ padding: '1rem', fontSize: '0.8rem' }}>
          Đang tải bình luận...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: '1rem', fontSize: '0.8rem' }}>
          Chưa có bình luận nào trên bài viết này.
        </div>
      ) : (
        <div className="comments-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-header">
                <span className="comment-author">👤 {c.from_name || 'Người dùng Facebook'}</span>
                <div className="flex items-center gap-8">
                  {c.created_time && (
                    <span className="comment-date">
                      {new Date(c.created_time * 1000).toLocaleString('vi-VN')}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    disabled={isWorking}
                    style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      cursor: isWorking ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem', padding: '2px 4px', marginLeft: '0.2rem',
                      opacity: isWorking ? 0.5 : 1
                    }}
                    title="Xóa bình luận"
                  >
                    {deleteCommentMutation.isPending ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
              <div className="comment-content">{c.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="comment-form">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-secondary">Viết bình luận mới</label>
          <button className="btn btn-sm text-sm flex items-center gap-2"
            style={{ fontSize: '0.72rem' }}
            onClick={() => setShowAiAssist(!showAiAssist)}>
            🪄 AI Trợ lý bình luận
          </button>
        </div>

        {showAiAssist && (
          <div className="ai-assist-box">
            <div className="flex items-center gap-8">
              <input type="checkbox" id="commentUseClipy" checked={useClipy}
                onChange={(e) => setUseClipy(e.target.checked)} />
              <label htmlFor="commentUseClipy" className="text-sm font-semibold" style={{ userSelect: 'none' }}>
                Đính kèm link rút gọn Clipy
              </label>
            </div>

            {useClipy && (
              <div className="flex-col gap-6 mt-4">
                <div className="form-group mb-0">
                  <input type="url" className="form-control form-control-sm"
                    placeholder="Link đích (ví dụ: https://shopee.vn/...)"
                    value={commentTargetUrl}
                    onChange={(e) => setCommentTargetUrl(e.target.value)} />
                </div>
                <div className="form-group mb-0">
                  <input type="text" className="form-control form-control-sm"
                    placeholder="Tiêu đề link (không bắt buộc)"
                    value={commentLinkTitle}
                    onChange={(e) => setCommentLinkTitle(e.target.value)} />
                </div>
                <div className="form-group mb-0">
                  <input type="text" className="form-control form-control-sm"
                    placeholder="Mô tả link (không bắt buộc)"
                    value={commentLinkDescription}
                    onChange={(e) => setCommentLinkDescription(e.target.value)} />
                </div>

                <div className="flex items-center gap-8 mt-4">
                  <input type="file" id={`commentImage-${postId}`} accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) cropper.handleImageSelect(file);
                    }} />
                  <label htmlFor={`commentImage-${postId}`}
                    className="btn btn-sm"
                    style={{ cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.5rem', marginBottom: 0 }}>
                    🖼️ Chọn ảnh xem trước cho link
                  </label>

                  {cropper.attachedImage && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={cropper.attachedImage} alt="Link preview OG"
                        style={{ maxHeight: '32px', borderRadius: '2px', border: '1px solid var(--border)' }} />
                      <button type="button" onClick={cropper.clearAttached}
                        style={{
                          position: 'absolute', top: '-4px', right: '-4px',
                          width: '12px', height: '12px', borderRadius: '50%',
                          background: '#ef4444', color: '#fff', border: 'none',
                          fontSize: '7px', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', padding: 0
                        }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button className="btn btn-sm btn-primary"
              onClick={handleGenerateComment}
              disabled={isWorking || (useClipy && !commentTargetUrl)}
              style={{ alignSelf: 'flex-start', fontSize: '0.72rem', marginTop: '0.25rem' }}>
              {generateCommentMutation.isPending ? '🤖 Đang tạo bình luận...' : '🤖 Viết bình luận bằng AI'}
            </button>
          </div>
        )}

        <textarea rows={3} className="form-control"
          placeholder="Nhập nội dung bình luận của bạn tại đây..."
          style={{ fontSize: '0.82rem', resize: 'vertical' }}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          disabled={isWorking} />

        <div className="flex justify-end mt-4">
          <button className="btn btn-sm btn-primary"
            onClick={handlePostComment}
            disabled={isWorking || !newCommentText.trim()}>
            {createCommentMutation.isPending ? 'Đang gửi...' : 'Gửi bình luận 🚀'}
          </button>
        </div>
      </div>

      {cropper.cropperSrc && (
        <ImageCropperModal
          cropperSrc={cropper.cropperSrc}
          aspectRatio={cropper.aspectRatio}
          setAspectRatio={cropper.setAspectRatio}
          allowRatioSelection={false}
          crop={cropper.crop}
          zoom={cropper.zoom}
          onCropChange={cropper.setCrop}
          onZoomChange={cropper.setZoom}
          onCropComplete={cropper.handleCropComplete}
          onConfirm={cropper.handleCropConfirm}
          onCancel={cropper.handleCropCancel}
        />
      )}
    </div>
  );
}
