import EasyCropper, { type Area } from 'react-easy-crop';

const Cropper = (EasyCropper as unknown as { default: typeof EasyCropper }).default ?? EasyCropper;

interface ImageCropperModalProps {
  cropperSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  aspectRatio: number | undefined;
  setAspectRatio: (val: number | undefined) => void;
  allowRatioSelection: boolean;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImageCropperModal({
  cropperSrc,
  crop,
  zoom,
  aspectRatio,
  setAspectRatio,
  allowRatioSelection,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onConfirm,
  onCancel,
}: ImageCropperModalProps) {
  if (!cropperSrc) return null;

  return (
    <div className="cropper-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="cropper-modal" style={{ maxWidth: '560px' }}>
        <div className="cropper-modal-header">
          <span>✂️ Cắt chỉnh kích thước ảnh</span>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '1.2rem', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div className="cropper-wrapper">
          <Cropper
            image={cropperSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="cropper-controls">
          {allowRatioSelection ? (
            <div className="flex-col gap-6">
              <span className="text-sm font-semibold text-secondary">
                Tỉ lệ khung hình (Aspect Ratio)
              </span>
              <div className="flex gap-8">
                <button
                  type="button"
                  className={`btn btn-sm btn-flex ${aspectRatio === 1 ? 'btn-primary' : ''}`}
                  style={{ background: aspectRatio === 1 ? undefined : 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  onClick={() => setAspectRatio(1)}
                >
                  1:1 (Square)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm btn-flex ${aspectRatio === 4/5 ? 'btn-primary' : ''}`}
                  style={{ background: aspectRatio === 4/5 ? undefined : 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  onClick={() => setAspectRatio(4/5)}
                >
                  4:5 (Portrait)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm btn-flex ${aspectRatio === 16/9 ? 'btn-primary' : ''}`}
                  style={{ background: aspectRatio === 16/9 ? undefined : 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  onClick={() => setAspectRatio(16/9)}
                >
                  16:9 (Landscape)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm btn-flex ${aspectRatio === undefined ? 'btn-primary' : ''}`}
                  style={{ background: aspectRatio === undefined ? undefined : 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  onClick={() => setAspectRatio(undefined)}
                >
                  Tự do
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-secondary">
              🔒 <strong>Đăng kèm link Clipy:</strong> Khóa tỉ lệ <strong>1.91:1</strong> chuẩn Facebook Link Card.
            </div>
          )}

          <div className="cropper-zoom-row mt-4">
            <span>🔍 Phóng to</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="cropper-slider"
            />
          </div>

          <div className="cropper-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm}>
              Cắt và Lưu ảnh 💾
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
