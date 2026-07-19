interface FileAttachmentProps {
  attachedFile: File | null;
  attachedImage: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  isGenerating: boolean;
  publishType: 'image' | 'link';
}

export default function FileAttachment({
  attachedFile,
  attachedImage,
  onImageSelect,
  onImageRemove,
  isGenerating,
  publishType
}: FileAttachmentProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.25rem' }} className="flex-col gap-12">
      <div>
        <label className="text-base font-semibold text-secondary" style={{ display: 'block', marginBottom: '0.4rem' }}>
          🖼️ Đính kèm hình ảnh {publishType === 'link' ? '(để tạo Link Preview Card)' : ''}
        </label>
        <div className="flex items-center gap-12">
          <input
            type="file"
            accept="image/*"
            id="image-attachment-generator"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={isGenerating}
          />
          <label
            htmlFor="image-attachment-generator"
            className="btn btn-sm"
            style={{
              cursor: 'pointer', background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)', display: 'inline-flex',
              alignItems: 'center', gap: '0.35rem', pointerEvents: isGenerating ? 'none' : 'auto',
              opacity: isGenerating ? 0.6 : 1
            }}
          >
            📁 Chọn ảnh từ thiết bị
          </label>
          {attachedFile && (
            <span className="text-sm text-success">✓ Đã đính kèm ảnh</span>
          )}
        </div>
        {attachedImage && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', marginTop: '0.65rem' }}>
            <img src={attachedImage} alt="Preview" loading="lazy" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={onImageRemove}
              style={{
                position: 'absolute', top: '0.25rem', right: '0.25rem',
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1
              }}
              title="Gỡ ảnh"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
