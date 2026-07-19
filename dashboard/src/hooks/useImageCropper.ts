import { useState } from 'react';
import { type Area } from 'react-easy-crop';
import { compressImage, getCroppedImg } from '@/utils/image.ts';
import { toErrorMessage } from '@/utils/errors.ts';
import { useToast } from '@/hooks/useToast.tsx';

export function useImageCropper(defaultAspect = 1) {
  const { addToast } = useToast();
  
  // Cropper states
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(defaultAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  // Result states
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleImageSelect = (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setCropperSrc(localUrl);
    setCropperFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleCropComplete = (_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  };

  const handleCropConfirm = async (): Promise<File | null> => {
    if (!cropperSrc || !croppedAreaPixels || !cropperFile) return null;
    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(cropperSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], cropperFile.name, { type: 'image/jpeg' });
      
      const compressedFile = await compressImage(croppedFile);
      
      setAttachedFile(compressedFile);
      setAttachedImage(URL.createObjectURL(compressedFile));
      
      handleCropCancel();
      return compressedFile;
    } catch (err) {
      addToast('Lỗi cắt ảnh: ' + toErrorMessage(err), 'error');
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const handleCropCancel = () => {
    setCropperSrc('');
    setCropperFile(null);
    setCroppedAreaPixels(null);
  };

  const clearAttached = () => {
    setAttachedFile(null);
    setAttachedImage(null);
  };

  return {
    cropperSrc,
    cropperFile,
    crop,
    zoom,
    aspectRatio,
    attachedImage,
    attachedFile,
    processing,
    setCrop,
    setZoom,
    setAspectRatio,
    setAttachedImage,
    setAttachedFile,
    handleImageSelect,
    handleCropComplete,
    handleCropConfirm,
    handleCropCancel,
    clearAttached,
  };
}
