/**
 * Image compression utility for fast avatar uploads
 * Resizes and compresses images client-side before upload
 */

export interface CompressedImage {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress and resize an image for avatar upload
 * 
 * @param file - Original image file
 * @param maxSize - Maximum width/height in pixels (default: 400 for avatars)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed image file
 */
export async function compressImageForAvatar(
  file: File,
  maxSize: number = 400,
  quality: number = 0.8
): Promise<CompressedImage> {
  const originalSize = file.size;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Draw image with smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          
          // Create new file with compressed data
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'), // Change extension to .jpg
            { type: 'image/jpeg' }
          );
          
          const compressedSize = compressedFile.size;
          const compressionRatio = originalSize / compressedSize;
          
          console.log(`📷 Image compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio.toFixed(1)}x smaller)`);
          
          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            compressionRatio
          });
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Load image from file
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}




