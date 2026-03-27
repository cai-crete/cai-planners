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
    const url = prompt('이미지 URL을 입력하세요:', 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?w=400&q=80');
    if (url) {
      addNode({
        id: `sticky-img-${Date.now()}`,
        type: 'sticky',
        position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
        data: { text: '이미지 메모', imageUrl: url },
      });
    }
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
