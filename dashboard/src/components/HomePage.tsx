import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { type Area } from 'react-easy-crop';
import {
  generatePost,
  publishPost,
  uploadImage,
  type PageData,
  type CampaignData,
  type GenerateResponse,
  type PublishResponse
} from '../api.ts';
import { compressImage, getCroppedImg } from '../utils/image.ts';
import PostGenerator from './PostGenerator.tsx';
import PostPreview from './PostPreview.tsx';
import LinkResultCard from './LinkResultCard.tsx';
import PublishModal from './PublishModal.tsx';
import ImageCropperModal from './ImageCropperModal.tsx';
import { useToast } from '../hooks/useToast.tsx';

interface HomePageProps {
  pages: PageData[];
  campaigns: CampaignData[];
  onDataChange?: () => void;
}

export default function HomePage({ pages, campaigns, onDataChange }: HomePageProps) {
  const { getToken } = useAuth();
  const { addToast } = useToast();
  
  // Page selection state
  const [selectedPageId, setSelectedPageId] = useState('');
  
  // Post configurations
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState('1. Sự thật thú vị (Interesting fact)');
  const [formula, setFormula] = useState('PAS (Problem-Agitation-Solution)');
  const [tone, setTone] = useState('Friendly');
  const [postFormat, setPostFormat] = useState<'Post' | 'Reel' | 'Video'>('Post');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // Clipy Link Options
  const [publishType, setPublishType] = useState<'image' | 'link'>('image');
  const [targetUrl, setTargetUrl] = useState('https://google.com');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');

  // Image Cropping States
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Volatile Action & Progress States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishContent, setPublishContent] = useState('');
  const [publishMediaUrl, setPublishMediaUrl] = useState<string | undefined>(undefined);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  // Set default active page
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const active = pages.find(p => p.is_active);
      if (active) setSelectedPageId(active.id);
      else setSelectedPageId(pages[0]!.id);
    }
  }, [pages, selectedPageId]);

  // Adjust aspect ratio automatically when publication format swaps
  useEffect(() => {
    setAspectRatio(publishType === 'link' ? 1.91 : 1);
  }, [publishType]);

  const handleGenerate = async (data: {
    topic: string;
    hookType: string;
    formula: string;
    tone: string;
    postFormat: 'Post' | 'Reel' | 'Video';
    campaignId?: string;
  }) => {
    setIsGenerating(true);
    setPublishResult(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');
      
      const result = await generatePost({
        topic: data.topic,
        hookType: data.hookType,
        formula: data.formula,
        tone: data.tone,
        postFormat: data.postFormat,
        publishType, // Pass to AI to conditionally generate link preview details
      }, token);
      
      setGenerationResult(result);
      setLinkTitle(result.linkTitle ?? '');
      setLinkDescription(result.linkDescription ?? '');
    } catch (err) {
      addToast(`Lỗi tạo bài viết: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShowPublishModal = (finalContent: string) => {
    if (!selectedPageId) {
      addToast('Vui lòng chọn Fanpage để đăng bài!', 'warning');
      return;
    }
    setPublishContent(finalContent);
    setPublishMediaUrl(attachedImage || undefined);
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async (finalContent: string, scheduledAt?: number) => {
    setIsPublishing(true);
    setPublishProgress('⏳ Đang chuẩn bị tiến trình đăng...');
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');

      let finalMediaUrl = publishMediaUrl;

      // 1. Unify file uploads — backend securely takes care of forwarding the image to Clipy
      if (attachedFile) {
        setPublishProgress('🖼️ Đang tải hình ảnh lên hệ thống...');
        const uploadRes = await uploadImage(attachedFile, token);
        finalMediaUrl = uploadRes.image_url;
      }

      setPublishProgress('📢 Đang xuất bản bài đăng lên Facebook...');

      // 2. Publish post payload with Clipy config handled securely on the backend worker
      const result = await publishPost({
        content: finalContent,
        pageId: selectedPageId,
        hookType: generationResult?.selectedHook,
        formula: generationResult?.formulaApplied,
        tone: generationResult?.tone ?? undefined,
        scheduledAt,
        campaignId: selectedCampaignId || undefined,
        generationId: generationResult?.generationId ?? undefined,
        mediaUrl: finalMediaUrl,
        publishType,
        targetUrl: publishType === 'link' ? targetUrl : undefined,
        linkTitle: publishType === 'link' ? linkTitle : undefined,
        linkDescription: publishType === 'link' ? linkDescription : undefined,
      }, token);

      // Clear draft on successful publish
      setGenerationResult(null);
      setAttachedImage(null);
      setAttachedFile(null);
      setTopic('');
      setLinkTitle('');
      setLinkDescription('');
      setPublishProgress('');

      setPublishResult(result);
      setShowPublishModal(false);
      onDataChange?.();
      addToast(scheduledAt ? 'Đã lên lịch bài viết thành công! 📅' : 'Đăng bài lên Fanpage thành công! 🚀', 'success');
    } catch (err) {
      addToast(`Lỗi đăng bài: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsPublishing(false);
      setPublishProgress('');
    }
  };

  const handleReset = () => {
    setGenerationResult(null);
    setPublishResult(null);
    setAttachedImage(null);
    setAttachedFile(null);
    setPublishMediaUrl(undefined);
    setTopic('');
    setLinkTitle('');
    setLinkDescription('');
    setPublishType('image');
    setTargetUrl('https://google.com');
  };

  // Image Cropper Handlers
  const handleImageSelect = (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setCropperSrc(localUrl);
    setCropperFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectRatio(publishType === 'link' ? 1.91 : 1);
  };

  const handleCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropConfirm = async () => {
    if (!cropperSrc || !croppedAreaPixels || !cropperFile) return;
    setIsPublishing(true);
    setPublishProgress('⏳ Đang cắt ảnh...');
    try {
      const croppedBlob = await getCroppedImg(cropperSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], cropperFile.name, { type: 'image/jpeg' });
      
      setPublishProgress('⏳ Đang nén và tối ưu hóa ảnh...');
      const compressedFile = await compressImage(croppedFile);
      
      setAttachedFile(compressedFile);
      setAttachedImage(URL.createObjectURL(compressedFile));
      
      setCropperSrc('');
      setCropperFile(null);
      setCroppedAreaPixels(null);
    } catch (err) {
      addToast('Lỗi cắt ảnh: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsPublishing(false);
      setPublishProgress('');
    }
  };

  const handleCropCancel = () => {
    setCropperSrc('');
    setCropperFile(null);
    setCroppedAreaPixels(null);
  };

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
          isPublishing={isPublishing}
          onConfirm={handleConfirmPublish}
          onCancel={() => { if (!isPublishing) setShowPublishModal(false); }}
        />
      )}

      {publishResult ? (
        <LinkResultCard
          permalink={publishResult.permalink}
          facebookPostId={publishResult.facebookPostId}
          onReset={handleReset}
        />
      ) : (
        <div className="generator-grid">
          <PostGenerator
            campaigns={campaigns}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            topic={topic}
            setTopic={setTopic}
            hookType={hookType}
            setHookType={setHookType}
            formula={formula}
            setFormula={setFormula}
            tone={tone}
            setTone={setTone}
            postFormat={postFormat}
            setPostFormat={setPostFormat}
            campaignId={selectedCampaignId}
            setCampaignId={setSelectedCampaignId}
            
            // Image upload and Publish Type props
            publishType={publishType}
            setPublishType={setPublishType}
            targetUrl={targetUrl}
            setTargetUrl={setTargetUrl}
            attachedFile={attachedFile}
            setAttachedFile={setAttachedFile}
            attachedImage={attachedImage}
            setAttachedImage={setAttachedImage}
            onImageSelect={handleImageSelect}
          />
          {generationResult ? (
            <PostPreview
              content={generationResult.content}
              isPublishing={isPublishing}
              onPublish={handleShowPublishModal}
              pages={pages}
              selectedPageId={selectedPageId}
              setSelectedPageId={setSelectedPageId}
              attachedImage={attachedImage}
              
              // Clipy Link Preview props
              publishType={publishType}
              linkTitle={linkTitle}
              setLinkTitle={setLinkTitle}
              linkDescription={linkDescription}
              setLinkDescription={setLinkDescription}
            />
          ) : (
            <div className="preview-card" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <p>🔮 Cấu hình cài đặt bên trái và nhấn nút "Tạo bài viết" để xem bản nháp AI.</p>
            </div>
          )}
        </div>
      )}

      {/* Image Cropper Modal */}
      {cropperSrc && (
        <ImageCropperModal
          cropperSrc={cropperSrc}
          crop={crop}
          zoom={zoom}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          allowRatioSelection={publishType === 'image'}
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
