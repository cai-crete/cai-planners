import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Sparkles, Lock, Loader2, Copy, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { enhanceNote, summarizeNote } from '../../lib/enhanceNote';

export interface StickyNodeData extends Record<string, unknown> {
  text: string;
  fullText?: string;
  imageUrl?: string;
  isLocked?: boolean;
}

export const StickyNode = memo(({ id, data, selected }: NodeProps<Node<StickyNodeData>>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [text, setText] = useState(data.text || '');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const isGenerating = useStore((state) => state.isGenerating);
  const { setNodes, setEdges } = useReactFlow();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = data.fullText || data.text;
    if (content) {
      navigator.clipboard.writeText(content);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
  };

  const handleDoubleClick = () => {
    if (!isGenerating && !data.isLocked && !isEnhancing) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    updateNodeData(id, { text });
  };

  const handleEnhance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating || data.isLocked || isEnhancing || !text.trim()) return;
    
    setIsEnhancing(true);
    try {
      const fullText = await enhanceNote(text);
      const summary = await summarizeNote(fullText);
      setText(summary);
      updateNodeData(id, { text: summary, fullText });
    } catch (error) {
      alert("AI 텍스트 보강에 실패했습니다.");
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div
      className={cn(
        'relative w-64 rounded-xl border bg-white p-4 pt-8 shadow-sm transition-all group',
        selected ? 'border-black ring-2 ring-black/20' : 'border-neutral-200',
        (isGenerating || data.isLocked || isEnhancing) && 'opacity-80'
      )}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {(isGenerating || data.isLocked) ? (
          <Lock className="h-4 w-4 text-neutral-400 m-1" />
        ) : isEnhancing ? (
          <div className="rounded-full p-1 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            <button
              onClick={handleEnhance}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors"
              title="Enhance Prompt"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors"
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt="Sticky Note Image"
          className="mb-3 h-32 w-full rounded-lg object-cover"
        />
      )}

      {isEditing ? (
        <textarea
          className="w-full resize-none bg-transparent text-sm outline-none"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          autoFocus
        />
      ) : (
        <div className="min-h-[4rem] whitespace-pre-wrap text-sm text-neutral-800">
          {text || '더블클릭하여 텍스트 입력...'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
