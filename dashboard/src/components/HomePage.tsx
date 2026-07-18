import { useState, useEffect } from 'react';
import { usePages } from '../hooks/usePages.ts';
import { useCampaigns } from '../hooks/useCampaigns.ts';
import { usePosts } from '../hooks/usePosts.ts';
import { useImageCropper } from '../hooks/useImageCropper.ts';
import { useToast } from '../hooks/useToast.tsx';
import PostGenerator from './PostGenerator.tsx';
import PostPreview from './PostPreview.tsx';
import LinkResultCard from './LinkResultCard.tsx';
import PublishModal from './PublishModal.tsx';
import ImageCropperModal from './ImageCropperModal.tsx';
import type { GenerateResponse, PublishResponse } from '../api.ts';

export default function HomePage() {
  const { addToast } = useToast();

  // Query hooks
  const { pagesQuery } = usePages();
  const { campaignsQuery } = useCampaigns();

  const pages = pagesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  // Selected Page State
  const [selectedPageId, setSelectedPageId] = useState('');

  // Post generation/publish state
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  // Link Preview States
  const [publishType, setPublishType] = useState<'image' | 'link'>('image');
  const [targetUrl, setTargetUrl] = useState('https://google.com');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');

  // Publish Dialog States
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishContent, setPublishContent] = useState('');
  const [publishMediaUrl, setPublishMediaUrl] = useState<string | undefined>(undefined);
  const [publishProgress, setPublishProgress] = useState('');

  // Image Cropper hook
  const cropper = useImageCropper(1);

  // Adjust aspect ratio based on publication format
  useEffect(() => {
    cropper.setAspectRatio(publishType === 'link' ? 1.91 : 1);
  }, [publishType]);

  // Set default active page
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const active = pages.find(p => p.is_active);
      if (active) setSelectedPageId(active.id);
      else setSelectedPageId(pages[0]!.id);
    }
  }, [pages, selectedPageId]);

  // Post mutation hook
  const { generatePostMutation, publishPostMutation, uploadImageMutation } = usePosts();

  const handleGenerate = async (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
    campaignId?: string;
  }) => {
    setPublishResult(null);
    try {
      const result = await generatePostMutation.mutateAsync({
        topic: data.topic,
        hookType: data.hookType,
        formula: data.formula,
        tone: data.tone,
        postFormat: data.postFormat,
        publishType,
      });

      setGenerationResult(result);
      setLinkTitle(result.linkTitle ?? '');
      setLinkDescription(result.linkDescription ?? '');
    } catch (err) {
      addToast(`Lỗi tạo bài viết: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleShowPublishModal = (finalContent: string) => {
    if (!selectedPageId) {
      addToast('Vui lòng chọn Fanpage để đăng bài!', 'warning');
      return;
    }
    setPublishContent(finalContent);
    setPublishMediaUrl(cropper.attachedImage || undefined);
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async (finalContent: string, scheduledAt?: number) => {
    setPublishProgress('⏳ Đang chuẩn bị tiến trình đăng...');
    try {
      let finalMediaUrl = publishMediaUrl;

      // Unify file upload
      if (cropper.attachedFile) {
        setPublishProgress('🖼️ Đang tải hình ảnh lên hệ thống...');
        const uploadRes = await uploadImageMutation.mutateAsync(cropper.attachedFile);
        finalMediaUrl = uploadRes.image_url;
      }

      setPublishProgress('📢 Đang xuất bản bài đăng lên Facebook...');

      const result = await publishPostMutation.mutateAsync({
        content: finalContent,
        pageId: selectedPageId,
        hookType: generationResult?.selectedHook ?? undefined,
        formula: generationResult?.formulaApplied ?? undefined,
        tone: generationResult?.tone ?? undefined,
        scheduledAt,
        campaignId: undefined, // Campaign is selected inside form config
        generationId: generationResult?.generationId ?? undefined,
        mediaUrl: finalMediaUrl,
        publishType,
        targetUrl: publishType === 'link' ? targetUrl : undefined,
        linkTitle: publishType === 'link' ? linkTitle : undefined,
        linkDescription: publishType === 'link' ? linkDescription : undefined,
      });

      // Clear draft on successful publish
      setGenerationResult(null);
      cropper.clearAttached();
      setLinkTitle('');
      setLinkDescription('');
      setPublishProgress('');

      setPublishResult(result);
      setShowPublishModal(false);
      addToast(scheduledAt ? 'Đã lên lịch bài viết thành công! 📅' : 'Đăng bài lên Fanpage thành công! 🚀', 'success');
    } catch (err) {
      addToast(`Lỗi đăng bài: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setPublishProgress('');
    }
  };

  const handleReset = () => {
    setGenerationResult(null);
    setPublishResult(null);
    cropper.clearAttached();
    setPublishMediaUrl(undefined);
    setLinkTitle('');
    setLinkDescription('');
    setPublishType('image');
    setTargetUrl('https://google.com');
  };

  const isWorking = generatePostMutation.isPending || publishPostMutation.isPending || cropper.processing || uploadImageMutation.isPending;

  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <h2>Tạo bài viết mới</h2>
      <p className="text-muted">AI sẽ viết nội dung dựa trên chủ đề, tối ưu cho Facebook.</p>

      {showPublishModal && (
        <PublishModal
          content={publishContent}
          mediaUrl={publishType === 'image' ? publishMediaUrl : undefined}
          publishProgress={publishProgress}
          pages={pages}
          selectedPageId={selectedPageId}
          isPublishing={publishPostMutation.isPending}
          onConfirm={handleConfirmPublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}

      {cropper.cropperSrc && (
        <ImageCropperModal
          cropperSrc={cropper.cropperSrc}
          crop={cropper.crop}
          zoom={cropper.zoom}
          aspectRatio={cropper.aspectRatio}
          setAspectRatio={cropper.setAspectRatio}
          allowRatioSelection={publishType === 'image'}
          onCropChange={cropper.setCrop}
          onZoomChange={cropper.setZoom}
          onCropComplete={cropper.handleCropComplete}
          onConfirm={cropper.handleCropConfirm}
          onCancel={cropper.handleCropCancel}
        />
      )}

      {publishResult ? (
        <div style={{ marginTop: '1.5rem' }}>
          <LinkResultCard
            permalink={publishResult.permalink}
            facebookPostId={publishResult.facebookPostId}
            onReset={handleReset}
          />
        </div>
      ) : (
        <div className="generator-grid">
          {/* Config column */}
          <PostGenerator
            campaigns={campaigns}
            onGenerate={handleGenerate}
            isGenerating={isWorking}
            attachedFile={cropper.attachedFile}
            attachedImage={cropper.attachedImage}
            onImageSelect={cropper.handleImageSelect}
            onImageRemove={cropper.clearAttached}
            publishType={publishType}
            setPublishType={setPublishType}
          />

          {/* Preview column */}
          <PostPreview
            content={generationResult?.content ?? ''}
            isPublishing={publishPostMutation.isPending}
            onPublish={handleShowPublishModal}
            pages={pages}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            attachedImage={cropper.attachedImage}
            publishType={publishType}
            linkTitle={linkTitle}
            setLinkTitle={setLinkTitle}
            linkDescription={linkDescription}
            setLinkDescription={setLinkDescription}
          />
        </div>
      )}
    </div>
  );
}
