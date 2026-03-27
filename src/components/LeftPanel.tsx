import { memo } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { MousePointer2, Hand, Undo2, Redo2, StickyNote, Image as ImageIcon } from 'lucide-react';

export const LeftPanel = memo(() => {
  const {
    toolMode,
    setToolMode,
    addNode,
  } = useStore();

  const handleAddSticky = () => {
    addNode({
      id: `sticky-${Date.now()}`,
      type: 'sticky',
      position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
      data: { text: '' },
    });
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = (re) => {
          const result = re.target?.result as string;
          addNode({
            id: `sticky-img-${Date.now()}`,
            type: 'sticky',
            position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
            data: { text: '', imageUrl: result },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <>
      {/* Floating Pill Toolbar */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 rounded-full bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-200">
        <button
          onClick={() => setToolMode('select')}
          className={cn("p-2.5 rounded-full transition-colors", toolMode === 'select' ? 'bg-black text-white' : 'text-neutral-600 hover:bg-neutral-100')}
          title="Select (V)"
        >
          <MousePointer2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setToolMode('pan')}
          className={cn("p-2.5 rounded-full transition-colors", toolMode === 'pan' ? 'bg-black text-white' : 'text-neutral-600 hover:bg-neutral-100')}
          title="Pan (H)"
        >
          <Hand className="w-5 h-5" />
        </button>

        <div className="w-6 h-px bg-neutral-200 my-1" />

        <button className="p-2.5 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 className="w-5 h-5" />
        </button>
        <button className="p-2.5 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors" title="Redo (Ctrl+Y)">
          <Redo2 className="w-5 h-5" />
        </button>

        <div className="w-6 h-px bg-neutral-200 my-1" />

        <button onClick={handleAddSticky} className="p-2.5 rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors" title="Add Text Note">
          <StickyNote className="w-5 h-5" />
        </button>
        <button onClick={handleAddImage} className="p-2.5 rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors" title="Add Image Note">
          <ImageIcon className="w-5 h-5" />
        </button>
      </div>
    </>
  );
});
