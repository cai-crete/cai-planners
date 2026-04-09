import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\nWn/g, '\n')
    .replace(/\\Wn/g, '\n')
    .replace(/\\\\n/g, '\n')
    .replace(/₩n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\W/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n\n');
}

/**
 * 전문가 요약(shortContent) 전용 sanitize:
 * 모든 개행 문자 및 리터럴 \n 문자열을 공백으로 치환하여
 * 한 줄짜리 요약문으로 만든다.
 */
export function sanitizeShort(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\nWn/g, ' ')
    .replace(/\\Wn/g, ' ')
    .replace(/\\\\n/g, ' ')
    .replace(/₩n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\\W/g, ' ')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * 프론트엔드 단에서 이미지를 resize하고 WebP로 최적화하는 함수
 * @param file 원본 이미지 파일
 * @param maxDimension 최대 가로/세로 픽셀
 */
export function resizeImageLocal(file: File, maxDimension: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.8)); // 0 토큰 최적화: WebP포맷, 80% 압축 사용
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
