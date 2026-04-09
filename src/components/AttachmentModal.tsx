import { memo, useRef } from 'react';
import { X, UploadCloud, FileImage, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: string | undefined;
  onImageChange: (image: string | undefined) => void;
}

export const AttachmentModal = memo(({ isOpen, onClose, image, onImageChange }: AttachmentModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      onImageChange(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onImageChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-[400px] max-w-[90%] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <h3 className="text-sm font-black uppercase tracking-widest text-black flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            Attachments
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-lg transition-colors text-neutral-500 hover:text-black">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {image ? (
            <div className="relative w-full rounded-2xl overflow-hidden group shadow-sm border border-neutral-200">
              <img src={image} alt="Preview" className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <button 
                  onClick={handleRemove}
                  className="px-4 py-2 bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-full hover:bg-red-600 transition-colors shadow-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Remove Image
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-400 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <div className="p-3 bg-white rounded-full shadow-sm">
                <UploadCloud className="w-6 h-6 text-black" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-700">Click to upload image</p>
                <p className="text-xs text-neutral-400 mt-1">Supports JPG, PNG, WEBP</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
