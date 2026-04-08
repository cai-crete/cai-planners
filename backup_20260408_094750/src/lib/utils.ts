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
