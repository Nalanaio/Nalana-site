const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.85;

/**
 * @param {File} file
 */
export function validateAvatarFile(file) {
  if (!file) return 'Please choose an image.';
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Use a JPG, PNG, WebP, or GIF image.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }
  return null;
}

/**
 * Resize image in the browser and return a JPEG data URL for avatar_url.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const err = validateAvatarFile(file);
    if (err) {
      reject(new Error(err));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch {
        reject(new Error('Could not process image.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };

    img.src = url;
  });
}
