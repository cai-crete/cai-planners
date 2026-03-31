import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Sparkles, Lock, Loader2, Copy, Trash2, FileMinus, ArrowRight, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { enhanceNote } from '../../lib/enhanceNote';
import { StickyNodeData, getPromptNodeData } from '../../types/nodes';

export const StickyNode = memo(({ id, data, selected }: NodeProps<Node<StickyNodeData>>) => {
  const pData = getPromptNodeData(data as any);
  const versions = pData.versions || [];
  const currentVersionId = pData.currentVersionId;
  const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];
  const activeText = currentVersion?.text || data.text || '';

  const [isEnhancing, setIsEnhancing] = useState(false);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const isGenerating = useStore((state) => state.isGenerating);
  const { setNodes, setEdges } = useReactFlow();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(activeText);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    useStore.getState().deleteNode(id);
  };

  const handleDeleteTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (versions.length > 1) {
      useStore.getState().deletePromptVersion(id, currentVersionId);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    useStore.getState().updatePromptTextWithBranching(id, currentVersionId, e.target.value);
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeText.trim()) {
      useStore.getState().reGenerateFromPrompt(id);
    }
  };

  const handleSwitchTab = (versionId: string) => {
    updateNodeData(id, { currentVersionId: versionId });
  };

  const handleEnhance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating || data.isLocked || isEnhancing || !activeText.trim()) return;
    
    setIsEnhancing(true);
    try {
      const { enhancePromptForRegenerate } = await import('../../lib/gemini');
      const enhanced = await enhancePromptForRegenerate(activeText);
      
      const updatedVersions = versions.map(v => 
        v.id === currentVersionId ? { ...v, text: enhanced } : v
      );

      updateNodeData(id, { 
        text: enhanced,
        versions: updatedVersions,
        currentVersionId: currentVersionId
      });
    } catch (error) {
      alert("AI 텍스트 최적화에 실패했습니다.");
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
      processImageFile(e.dataTransfer.files[0]);
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

  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const isFocused = selected || selectedNodeId === id;

  const isPromptNodeType = (data.versions && data.versions.length > 0) || versions.length > 1;

  return (
    <div
      className={cn(
        'w-[300px] rounded-2xl bg-white p-4 shadow-lg flex flex-col gap-3 relative transition-all duration-300 border-2 group',
        isFocused ? 'border-black ring-2 ring-black/20 scale-[1.02]' : 'border-neutral-200',
        (isGenerating || data.isLocked || isEnhancing) && 'opacity-80'
      )}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="flex flex-col gap-2">
        {/* Tabs Bar: 버전 탭이 2개 이상이거나 원래 Prompt 기반일 때 */}
        {versions.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 animate-in fade-in slide-in-from-top-1">
            {versions.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => handleSwitchTab(v.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 border",
                  v.id === currentVersionId 
                    ? "bg-white border-black text-black shadow-sm" 
                    : "bg-neutral-50 border-transparent text-neutral-400 hover:bg-neutral-100"
                )}
              >
                <div 
                  className={cn("w-1.5 h-1.5 rounded-full", !v.color && "bg-neutral-300")} 
                  style={v.color ? { backgroundColor: v.color } : {}}
                />
                V{idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-800 flex items-center gap-1.5">
              {isPromptNodeType ? <Sparkles className="h-3.5 w-3.5 text-black" /> : <MessageSquare className="h-3.5 w-3.5 text-neutral-400" />}
              {isPromptNodeType ? 'PROMPT NODE' : 'TEXT NOTE'}
            </h3>
            <label
              className="cursor-pointer rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
              title="Upload Image"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
          
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
            {versions.length > 1 && (
              <button
                onClick={handleDeleteTab}
                className="text-neutral-400 hover:text-orange-500 transition-colors p-1"
                title="Delete Current V-Tab"
              >
                <FileMinus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="text-neutral-400 hover:text-red-500 transition-colors p-1"
              title="Delete Entire Node"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt="Attached"
          className="mb-1 h-32 w-full rounded-lg object-[center_top]"
        />
      )}

      {isFocused ? (
        <textarea
          className="w-full h-[120px] resize-none outline-none text-sm text-neutral-800 placeholder-neutral-300 bg-transparent custom-scrollbar nodrag"
          placeholder="Enter prompt or text..."
          value={activeText}
          onChange={handleTextChange}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus={!data.imageUrl}
        />
      ) : (
        <div className="w-full h-[120px] overflow-hidden text-sm text-neutral-800 whitespace-pre-wrap custom-scrollbar cursor-text">
          {activeText || <span className="text-neutral-300 italic">Enter prompt or text...</span>}
        </div>
      )}

      {isFocused && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 gap-2 transition-all animate-in fade-in slide-in-from-top-1">
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
            title="Copy Text"
          >
            <Copy className="h-3.5 w-3.5" /> 
          </button>
          <button
            onClick={handleEnhance}
            disabled={!activeText.trim() || isEnhancing || isGenerating}
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-black transition-colors",
              isEnhancing && "animate-pulse"
            )}
            title="Enhance Prompt (AI)"
          >
            {isEnhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={!activeText.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-neutral-900 text-white hover:bg-black transition-colors shadow-sm text-xs font-bold disabled:opacity-50"
            title="Generate Strategy"
          >
            GENERATE <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
