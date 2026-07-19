import { useState, useEffect } from 'react';
import { usePages } from '@/hooks/usePages.ts';
import { useCampaigns } from '@/hooks/useCampaigns.ts';
import { usePosts } from '@/hooks/usePosts.ts';
import { useImageCropper } from '@/hooks/useImageCropper.ts';
import { useToast } from '@/hooks/useToast.tsx';
import { toErrorMessage } from '@/utils/errors.ts';
import PostGenerator from '@/components/PostGenerator.tsx';
import PostPreview from '@/components/PostPreview.tsx';
import ReelPreview from '@/components/ReelPreview.tsx';
import LinkResultCard from '@/components/LinkResultCard.tsx';
import PublishModal from '@/components/PublishModal.tsx';
import ImageCropperModal from '@/components/ImageCropperModal.tsx';
import type { GenerateResponse, PublishResponse } from '@/api/types.ts';

export default function HomePage() {
  const { addToast } = useToast();

  const { pagesQuery } = usePages();
  const { campaignsQuery } = useCampaigns();

  const pages = pagesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  const [selectedPageId, setSelectedPageId] = useState('');

  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  const [publishType, setPublishType] = useState<'image' | 'link'>('image');
  const [targetUrl, setTargetUrl] = useState('https://google.com');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [currentPostFormat, setCurrentPostFormat] = useState<'Post' | 'Reel' | 'Video'>('Post');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishContent, setPublishContent] = useState('');
  const [publishMediaUrl, setPublishMediaUrl] = useState<string | undefined>(undefined);
  const [publishProgress, setPublishProgress] = useState('');

  const [reelDuration, setReelDuration] = useState<number | undefined>(undefined);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const cropper = useImageCropper(1);

  useEffect(() => {
    cropper.setAspectRatio(publishType === 'link' ? 1.91 : 1);
  }, [publishType]);

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const active = pages.find(p => p.is_active);
      if (active) setSelectedPageId(active.id);
      else setSelectedPageId(pages[0]?.id ?? '');
    }
  }, [pages, selectedPageId]);

  const { generatePostMutation, publishPostMutation, publishReelMutation, uploadImageMutation, uploadVideoMutation } = usePosts();

  const handleGenerate = async (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
    campaignId?: string;
    publishType: 'image' | 'link';
    targetUrl: string;
    reelDuration?: number;
  }) => {
    setPublishResult(null);
    setCurrentPostFormat(data.postFormat);
    setReelDuration(data.reelDuration);
    try {
      const result = await generatePostMutation.mutateAsync({
        topic: data.topic,
        hookType: data.hookType,
        formula: data.formula,
        tone: data.tone,
        postFormat: data.postFormat,
        publishType: data.publishType,
        reelDuration: data.reelDuration,
      });

      setGenerationResult(result);
      setLinkTitle(result.linkTitle ?? '');
      setLinkDescription(result.linkDescription ?? '');
    } catch (err) {
      addToast(`Lỗi tạo bài viết: ${toErrorMessage(err)}`, 'error');
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

  const handlePublishReel = async () => {
    if (!selectedPageId) {
      addToast('Vui lòng chọn Fanpage để đăng bài!', 'warning');
      return;
    }
    if (!generationResult?.content) {
      addToast('Chưa có nội dung Reel để đăng.', 'warning');
      return;
    }

    setPublishProgress('⏳ Đang chuẩn bị đăng Reel...');
    try {
      let finalVideoUrl: string | undefined;

      if (videoFile) {
        setPublishProgress('🎬 Đang tải video lên hệ thống...');
        const uploadRes = await uploadVideoMutation.mutateAsync(videoFile);
        finalVideoUrl = uploadRes.video_url;
      }

      if (!finalVideoUrl) {
        addToast('Vui lòng tải lên video để đăng Reel.', 'error');
        setPublishProgress('');
        return;
      }

      setPublishProgress('📢 Đang xuất bản Reel lên Facebook...');

      const result = await publishReelMutation.mutateAsync({
        videoUrl: finalVideoUrl,
        caption: generationResult.content,
        pageId: selectedPageId,
        reelDuration,
        scriptSegments: generationResult.scriptSegments ? JSON.stringify(generationResult.scriptSegments) : undefined,
        hookType: generationResult.selectedHook,
        formula: generationResult.formulaApplied,
        tone: generationResult.tone,
        generationId: generationResult.generationId,
      });

      setGenerationResult(null);
      setVideoFile(null);
      setVideoPreviewUrl(null);
      setPublishProgress('');

      setPublishResult(result);
      addToast('Đăng Reel lên Fanpage thành công! 🎬', 'success');
    } catch (err) {
      addToast(`Lỗi đăng Reel: ${toErrorMessage(err)}`, 'error');
    } finally {
      setPublishProgress('');
    }
  };

  const handleConfirmPublish = async (finalContent: string, scheduledAt?: number) => {
    setPublishProgress('⏳ Đang chuẩn bị tiến trình đăng...');
    try {
      let finalMediaUrl = publishMediaUrl;

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
        campaignId: undefined,
        generationId: generationResult?.generationId ?? undefined,
        mediaUrl: finalMediaUrl,
        publishType,
        targetUrl: publishType === 'link' ? targetUrl : undefined,
        linkTitle: publishType === 'link' ? linkTitle : undefined,
        linkDescription: publishType === 'link' ? linkDescription : undefined,
      });

      setGenerationResult(null);
      cropper.clearAttached();
      setLinkTitle('');
      setLinkDescription('');
      setPublishProgress('');

      setPublishResult(result);
      setShowPublishModal(false);
      addToast(scheduledAt ? 'Đã lên lịch bài viết thành công! 📅' : 'Đăng bài lên Fanpage thành công! 🚀', 'success');
    } catch (err) {
      addToast(`Lỗi đăng bài: ${toErrorMessage(err)}`, 'error');
    } finally {
      setPublishProgress('');
    }
  };

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
  };

  const handleVideoRemove = () => {
    setVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
  };

  const handleReset = () => {
    setGenerationResult(null);
    setPublishResult(null);
    setCurrentPostFormat('Post');
    cropper.clearAttached();
    setPublishMediaUrl(undefined);
    setLinkTitle('');
    setLinkDescription('');
    setPublishType('image');
    setTargetUrl('https://google.com');
    handleVideoRemove();
  };

  const isWorking = generatePostMutation.isPending || publishPostMutation.isPending || publishReelMutation.isPending || cropper.processing || uploadImageMutation.isPending || uploadVideoMutation.isPending;
  const isReelResult = currentPostFormat === 'Reel' && generationResult?.scriptSegments;

  return (
    <div className="container">
      <div className="spacer-24" />
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

          {isReelResult ? (
            <ReelPreview
              caption={generationResult.content}
              scriptSegments={generationResult.scriptSegments ?? []}
              reelDuration={reelDuration}
              videoFile={videoFile}
              videoPreviewUrl={videoPreviewUrl}
              onVideoSelect={handleVideoSelect}
              onVideoRemove={handleVideoRemove}
              isPublishing={publishReelMutation.isPending || uploadVideoMutation.isPending}
              onPublish={handlePublishReel}
              publishProgress={publishProgress}
              pages={pages}
              selectedPageId={selectedPageId}
              setSelectedPageId={setSelectedPageId}
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
