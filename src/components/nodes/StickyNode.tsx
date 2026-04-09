import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Sparkles, Lock, Loader2, Copy, Trash2, FileMinus, ArrowRight, MessageSquare } from 'lucide-react';
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
  const firstPromptText = useStore((state) => state.firstPromptText);
  const lastActiveNodeId = useStore((state) => state.lastActiveNodeId);
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
    useStore.getState().updatePromptTextWithBranching(id, currentVersionId, e.target.value, undefined);
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
      const enhanced = await enhanceNote(activeText);
      
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

  const isFocused = selected;

  const isPromptNodeType = (data.versions && data.versions.length > 0) || versions.length > 1;

  return (
    <div
      className={cn(
        'w-[300px] rounded-2xl bg-white p-4 shadow-lg flex flex-col gap-3 relative border-2 group transition-[border-color,box-shadow] duration-300',
        lastActiveNodeId === id ? 'border-black ring-2 ring-black/20' : 'border-neutral-200',
        (isGenerating || data.isLocked || isEnhancing) && 'opacity-80'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />

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

      {isFocused ? (
        <textarea
          className="w-full h-[120px] resize-none outline-none text-sm text-neutral-800 placeholder-neutral-300 bg-transparent custom-scrollbar nodrag"
          placeholder="Enter prompt or text..."
          value={activeText || firstPromptText}
          onChange={handleTextChange}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus={true}
        />
      ) : (
        <div className="w-full h-[120px] overflow-hidden text-sm text-neutral-800 whitespace-pre-wrap custom-scrollbar cursor-text">
          {activeText || firstPromptText || <span className="text-neutral-300 italic">Enter prompt or text...</span>}
        </div>
      )}

      {isFocused && (
        <div className="absolute left-0 right-0 top-full mt-2 flex items-center justify-between px-4 py-2.5 bg-white border border-neutral-200 rounded-2xl shadow-lg gap-2 z-50 animate-in fade-in slide-in-from-top-2 nodrag">
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

    </div>
  );
});
