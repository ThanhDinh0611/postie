import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  generatePost,
  publishPost,
  uploadImage,
  type PageData,
  type CampaignData,
  type GenerateResponse,
  type PublishResponse
} from '../api.ts';
import PostGenerator from './PostGenerator.tsx';
import PostPreview from './PostPreview.tsx';
import LinkResultCard from './LinkResultCard.tsx';
import PublishModal from './PublishModal.tsx';

interface HomePageProps {
  pages: PageData[];
  campaigns: CampaignData[];
  onDataChange?: () => void;
}

export default function HomePage({ pages, campaigns, onDataChange }: HomePageProps) {
  const { getToken } = useAuth();
  
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
      // Retrieve AI-generated card details
      setLinkTitle(result.linkTitle ?? '');
      setLinkDescription(result.linkDescription ?? '');
    } catch (err) {
      alert(`⚠️ Lỗi tạo bài viết: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShowPublishModal = (finalContent: string) => {
    if (!selectedPageId) {
      alert('⚠️ Vui lòng chọn Fanpage để đăng bài!');
      return;
    }
    setPublishContent(finalContent);
    setPublishMediaUrl(attachedImage || undefined);
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async (finalContent: string, scheduledAt?: number) => {
    setIsPublishing(true);
    setPublishProgress('⏳ Đang khởi tạo tiến trình đăng bài...');
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');

      let finalMediaUrl = publishMediaUrl;
      let shortUrl = '';

      if (publishType === 'image') {
        // Image Post Flow: Upload to Postie R2
        if (attachedFile) {
          setPublishProgress('🖼️ Đang tải hình ảnh lên Postie R2...');
          const uploadRes = await uploadImage(attachedFile, token);
          finalMediaUrl = uploadRes.image_url;
        }
      } else if (publishType === 'link') {
        // Clipy Link Post Flow:
        let clipyImageUrl = '';
        if (attachedFile) {
          setPublishProgress('🖼️ Đang tải hình ảnh lên Clipy R2...');
          const formData = new FormData();
          formData.append('image', attachedFile);
          
          const uploadRes = await fetch('https://clipy-worker.dct98.workers.dev/api/upload', {
            method: 'POST',
            body: formData
          });
          if (!uploadRes.ok) {
            throw new Error(`Clipy R2 upload failed with status ${uploadRes.status}`);
          }
          const uploadData = await uploadRes.json() as { image_url: string };
          clipyImageUrl = uploadData.image_url;
        }

        setPublishProgress('🔗 Đang rút gọn link qua Clipy API...');
        const linkRes = await fetch('https://clipy-worker.dct98.workers.dev/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer cl_live_rA84GqkCnTdxqFWtCYgPobKL7NJwzXUb'
          },
          body: JSON.stringify({
            target_url: targetUrl || 'https://google.com',
            title: linkTitle || topic.slice(0, 60),
            description: linkDescription || 'Shared via Clipy',
            image_url: clipyImageUrl
          })
        });

        if (!linkRes.ok) {
          const errMsg = await linkRes.text();
          throw new Error(`Lỗi tạo link Clipy: ${linkRes.status} ${errMsg}`);
        }
        
        const linkData = await linkRes.json() as { short_code: string };
        shortUrl = `https://clipy-worker.dct98.workers.dev/${linkData.short_code}`;
      }

      setPublishProgress('📢 Đang xuất bản bài đăng lên Facebook...');
      
      const messageContent = publishType === 'link' && shortUrl
        ? `${finalContent}\n\n👉 Chi tiết xem tại: ${shortUrl}`
        : finalContent;

      const result = await publishPost({
        content: messageContent,
        pageId: selectedPageId,
        hookType: generationResult?.selectedHook,
        formula: generationResult?.formulaApplied,
        tone: generationResult?.tone ?? undefined,
        scheduledAt,
        campaignId: selectedCampaignId || undefined,
        generationId: generationResult?.generationId ?? undefined,
        mediaUrl: publishType === 'image' ? finalMediaUrl : undefined, // Don't pass mediaUrl if link post (Facebook parses link OG image instead)
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
    } catch (err) {
      alert(`⚠️ Lỗi đăng bài: ${err instanceof Error ? err.message : String(err)}`);
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
    </div>
  );
}
