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
    .replace(/₩n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\W/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n\n');
}
