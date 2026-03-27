import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { ArrowRight, Sparkles, Copy, Trash2 } from 'lucide-react';

export interface PromptNodeData extends Record<string, unknown> {
  prompt: string;
}

export const PromptNode = memo(({ id, data, selected }: NodeProps<Node<PromptNodeData>>) => {
  const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!localPrompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      // enhancePromptForRegenerate 함수는 gemini.ts에서 가져옵니다 (아래에서 import 추가)
      const { enhancePromptForRegenerate } = await import('../../lib/gemini');
      const enhanced = await enhancePromptForRegenerate(localPrompt);
      setLocalPrompt(enhanced);
      useStore.getState().updateNodeData(id, { prompt: enhanced });
    } catch (e) {
      console.error('Enhance failed', e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localPrompt);
  };

  const handleDelete = () => {
    useStore.getState().deleteNode(id);
  };

  const handleRegenerate = () => {
    if (localPrompt.trim()) {
      useStore.getState().updateNodeData(id, { prompt: localPrompt });
      useStore.getState().reGenerateFromPrompt(id);
    }
  };

  const selectedNodeId = useStore((state) => state.selectedNodeId);
  
  return (
    <div
      className={cn(
        'w-[300px] rounded-2xl bg-white p-4 shadow-lg flex flex-col gap-3 relative transition-all duration-300 border-2',
        (selected || selectedNodeId === id) ? 'border-black ring-2 ring-black/20' : 'border-neutral-200'
      )}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-neutral-800" />

      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-800 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-black" />
          Prompt Node
        </h3>
        <button
          onClick={handleDelete}
          className="text-neutral-400 hover:text-black transition-colors"
          title="Delete Prompt Node"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <textarea
        className="w-full h-[120px] resize-none outline-none text-sm text-neutral-800 placeholder-neutral-300 bg-transparent custom-scrollbar"
        placeholder="Enter your prompt for re-generation..."
        value={localPrompt}
        onChange={(e) => {
          setLocalPrompt(e.target.value);
          useStore.getState().updateNodeData(id, { prompt: e.target.value });
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {selected && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 gap-2 transition-all animate-in fade-in slide-in-from-top-1">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors text-xs font-bold"
            title="Copy Prompt"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleEnhance}
            disabled={!localPrompt.trim() || isEnhancing}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-black transition-colors text-xs font-bold",
              isEnhancing && "animate-pulse"
            )}
            title="Enhance Prompt"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleRegenerate}
            disabled={!localPrompt.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-neutral-900 text-white hover:bg-black transition-colors shadow-sm text-xs font-bold disabled:opacity-50"
            title="Re-generate Strategy"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-neutral-800" />
    </div>
  );
});
