import { useState, useEffect, useRef } from 'react';
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
  
  // Persistent Draft States (Per Page)
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState('1. Sự thật thú vị (Interesting fact)');
  const [formula, setFormula] = useState('PAS (Problem-Agitation-Solution)');
  const [tone, setTone] = useState('Friendly');
  const [postFormat, setPostFormat] = useState<'Post' | 'Reel' | 'Video'>('Post');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // Volatile Action States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishContent, setPublishContent] = useState('');
  const [publishMediaUrl, setPublishMediaUrl] = useState<string | undefined>(undefined);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  const loadedPageIdRef = useRef(selectedPageId);

  // Set default active page
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const active = pages.find(p => p.is_active);
      if (active) setSelectedPageId(active.id);
      else setSelectedPageId(pages[0]!.id);
    }
  }, [pages, selectedPageId]);

  // Load draft from localStorage when page selection changes
  useEffect(() => {
    if (!selectedPageId) return;
    const key = `postie_draft_page_${selectedPageId}`;
    const stored = localStorage.getItem(key);
    
    // Always clear the preview card when changing selected page to prevent cross-page publishing errors
    setGenerationResult(null);
    setAttachedImage(null);
    setAttachedFile(null);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        setTopic(data.topic ?? '');
        setHookType(data.hookType ?? '1. Sự thật thú vị (Interesting fact)');
        setFormula(data.formula ?? 'PAS (Problem-Agitation-Solution)');
        setTone(data.tone ?? 'Friendly');
        setPostFormat(data.postFormat ?? 'Post');
        setSelectedCampaignId(data.campaignId ?? '');
      } catch (err) {
        console.error('Failed to parse draft from localStorage:', err);
      }
    } else {
      // Clear/Reset to defaults for a page with no draft
      setTopic('');
      setHookType('1. Sự thật thú vị (Interesting fact)');
      setFormula('PAS (Problem-Agitation-Solution)');
      setTone('Friendly');
      setPostFormat('Post');
      setSelectedCampaignId('');
    }
    
    // Mark that this page ID's states have been loaded/synchronized
    loadedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  // Save draft to localStorage when states change
  useEffect(() => {
    // Only save if selectedPageId matches the loaded page state (prevents saving old states to the new page ID during transition)
    if (!selectedPageId || loadedPageIdRef.current !== selectedPageId) return;
    
    const key = `postie_draft_page_${selectedPageId}`;
    const data = {
      topic,
      hookType,
      formula,
      tone,
      postFormat,
      campaignId: selectedCampaignId,
      generationResult,
      attachedImage: attachedImage && !attachedImage.startsWith('blob:') ? attachedImage : null
    };
    localStorage.setItem(key, JSON.stringify(data));
  }, [selectedPageId, topic, hookType, formula, tone, postFormat, selectedCampaignId, generationResult, attachedImage]);

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
        postFormat: data.postFormat
      }, token);
      setGenerationResult(result);
    } catch (err) {
      alert(`⚠️ Lỗi tạo bài viết: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShowPublishModal = (finalContent: string, mediaUrl?: string) => {
    if (!selectedPageId) {
      alert('⚠️ Vui lòng chọn Fanpage để đăng bài!');
      return;
    }
    setPublishContent(finalContent);
    setPublishMediaUrl(mediaUrl || attachedImage || undefined);
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async (finalContent: string, scheduledAt?: number) => {
    setIsPublishing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Unauthorized');

      let finalMediaUrl = publishMediaUrl;
      // Perform client-side R2 upload here when confirming publish
      if (attachedFile) {
        const uploadRes = await uploadImage(attachedFile, token);
        finalMediaUrl = uploadRes.image_url;
      }

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
      }, token);

      // Clear draft on successful publish
      setGenerationResult(null);
      setAttachedImage(null);
      setAttachedFile(null);
      setTopic('');
      if (selectedPageId) {
        localStorage.removeItem(`postie_draft_page_${selectedPageId}`);
      }

      setPublishResult(result);
      setShowPublishModal(false);
      onDataChange?.();
    } catch (err) {
      alert(`⚠️ Lỗi đăng bài: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setGenerationResult(null);
    setPublishResult(null);
    setAttachedImage(null);
    setAttachedFile(null);
    setPublishMediaUrl(undefined);
    setTopic('');
    if (selectedPageId) {
      localStorage.removeItem(`postie_draft_page_${selectedPageId}`);
    }
  };

  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <h2>Tạo bài viết mới</h2>
      <p className="text-muted">AI sẽ viết nội dung dựa trên chủ đề, tối ưu cho Facebook.</p>

      {showPublishModal && (
        <PublishModal
          content={publishContent}
          mediaUrl={publishMediaUrl}
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
              setAttachedImage={setAttachedImage}
              attachedFile={attachedFile}
              setAttachedFile={setAttachedFile}
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
