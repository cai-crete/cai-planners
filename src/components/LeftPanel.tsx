import { memo } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { MousePointer2, Undo2, Redo2, Image as ImageIcon, Search, MessageSquare } from 'lucide-react';

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
    <div className="absolute left-8 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4">
      {/* Main Pill Toolbar */}
      <div className="flex flex-col items-center gap-1 rounded-full bg-black p-2 shadow-2xl">
        <button
          onClick={() => setToolMode('select')}
          className={cn("p-2.5 rounded-full transition-colors", toolMode === 'select' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white')}
          title="Select (V)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        <button
          className={cn("p-2.5 rounded-full transition-colors text-neutral-400 hover:text-white")}
          title="Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button className="p-2.5 rounded-full text-neutral-500 hover:text-white transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </button>
        <button className="p-2.5 rounded-full text-neutral-500 hover:text-white transition-colors" title="Redo (Ctrl+Y)">
          <Redo2 className="w-4 h-4" />
        </button>

        <button className="p-2.5 rounded-full text-neutral-400 hover:text-white transition-colors" title="Search">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Separate Image Button */}
      <button 
        onClick={handleAddImage} 
        className="flex items-center justify-center w-[42px] h-[42px] rounded-full bg-black text-neutral-400 hover:text-white shadow-2xl transition-all active:scale-95" 
        title="Add Image"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
    </div>
  );
});
