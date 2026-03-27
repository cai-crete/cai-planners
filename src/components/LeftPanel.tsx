import { memo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { useReactFlow } from '@xyflow/react';
import { 
  Navigation, 
  MessageSquare, 
  Undo2, 
  Redo2, 
  Search, 
  ImagePlus, 
  Maximize, 
  Minus, 
  Plus 
} from 'lucide-react';

export const LeftPanel = memo(() => {
  const {
    toolMode,
    setToolMode,
    addNode,
  } = useStore();

  const { zoomIn, zoomOut, zoomTo, fitView, getViewport } = useReactFlow();
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  // 현재 줌 레벨 동기화
  useEffect(() => {
    const interval = setInterval(() => {
      const zoom = getViewport().zoom;
      setZoomLevel(Math.round(zoom * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [getViewport]);

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
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3">
      {/* Main Pill Toolbar */}
      <div className="flex flex-col items-center gap-1 rounded-full bg-white p-[5px] border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] origin-left">
        {/* Nav Button (Black Circle) */}
        <button
          onClick={() => setToolMode('select')}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-full transition-all",
            toolMode === 'select' ? "bg-black text-white" : "text-neutral-400 hover:bg-neutral-50"
          )}
        >
          <Navigation className="w-4 h-4 rotate-[-45deg] fill-current" />
        </button>

        {/* Message Button */}
        <button
          onClick={handleAddSticky}
          className="w-9 h-9 flex items-center justify-center rounded-full text-black hover:bg-neutral-50 transition-all font-bold"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-7 h-[1px] bg-neutral-100 my-0.5" />

        {/* Undo Button */}
        <button className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-50 transition-all font-bold">
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo Button */}
        <button className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-50 transition-all font-bold">
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-7 h-[1px] bg-neutral-100 my-0.5" />

        {/* Search/Zoom Toggle Button */}
        <div className="relative flex items-center">
          <button
            onClick={() => setIsZoomOpen(!isZoomOpen)}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-full transition-all font-bold",
              isZoomOpen ? "bg-black text-white" : "text-black hover:bg-neutral-50"
            )}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Zoom Panel (Horizontal) */}
          {isZoomOpen && (
            <div className="absolute left-12 flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200">
              <button 
                className="text-black hover:opacity-60 transition-opacity"
                onClick={() => fitView({ duration: 800 })}
                title="Fit View"
              >
                <Maximize className="w-4 h-4" />
              </button>
              
              <div className="w-[1px] h-4 bg-neutral-200 mx-1" />
              
              <button 
                className="text-black hover:opacity-60 transition-opacity"
                onClick={() => zoomOut()}
                title="Zoom Out"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <span className="text-[11px] font-black w-10 text-center select-none">
                {zoomLevel}%
              </span>
              
              <button 
                className="text-black hover:opacity-60 transition-opacity"
                onClick={() => zoomIn()}
                title="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Separate Image Button (Bottom) */}
      <button 
        onClick={handleAddImage} 
        className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white shadow-lg hover:opacity-90 transition-all active:scale-95 mt-1" 
      >
        <ImagePlus className="w-4 h-4" />
      </button>
    </div>
  );
});
