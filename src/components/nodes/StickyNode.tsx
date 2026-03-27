import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Sparkles, Lock, Loader2, Copy, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { enhanceNote, summarizeNote } from '../../lib/enhanceNote';
import { StickyNodeData } from '../../types/nodes';

export const StickyNode = memo(({ id, data, selected }: NodeProps<Node<StickyNodeData>>) => {
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    updateNodeData(id, { text: e.target.value });
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

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateNodeData(id, { imageUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={cn(
        'relative w-64 rounded-xl border bg-white p-4 pt-8 shadow-sm transition-all group',
        selected ? 'border-black ring-2 ring-black/20' : 'border-neutral-200',
        (isGenerating || data.isLocked || isEnhancing) && 'opacity-80'
      )}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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

      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <label
          className="cursor-pointer rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center"
          title="Upload Image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt="Sticky Note Image"
          className="mb-3 h-32 w-full rounded-lg object-cover"
        />
      )}

      {selected ? (
        <textarea
          className="w-full resize-none bg-transparent text-sm outline-none nodrag"
          rows={4}
          value={text}
          onChange={handleTextChange}
          placeholder="텍스트를 입력하세요..."
          autoFocus
        />
      ) : (
        <div className="min-h-[4rem] whitespace-pre-wrap text-sm text-neutral-800">
          {text || '텍스트를 입력하세요...'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
