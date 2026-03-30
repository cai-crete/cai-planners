import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { ArrowRight, Sparkles, Copy, Trash2 } from 'lucide-react';
import { PromptNodeData, getPromptNodeData } from '../../types/nodes';

export const PromptNode = memo(({ id, data, selected }: NodeProps<Node<PromptNodeData>>) => {
  const pData = getPromptNodeData(data);
  const versions = pData.versions;
  const currentVersionId = pData.currentVersionId;
  const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];

  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!(currentVersion?.text || '').trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const { enhancePromptForRegenerate } = await import('../../lib/gemini');
      const enhanced = await enhancePromptForRegenerate(currentVersion.text);
      
      const updatedVersions = versions.map(v => 
        v.id === currentVersionId ? { ...v, text: enhanced } : v
      );

      useStore.getState().updateNodeData(id, { 
        versions: updatedVersions,
        currentVersionId: currentVersionId
      });
    } catch (e) {
      console.error('Enhance failed', e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentVersion.text);
  };

  const handleDelete = () => {
    useStore.getState().deleteNode(id);
  };

  const handleRegenerate = () => {
    if ((currentVersion?.text || '').trim()) {
      useStore.getState().reGenerateFromPrompt(id);
    }
  };

  const handleSwitchTab = (versionId: string) => {
    useStore.getState().updateNodeData(id, { currentVersionId: versionId });
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

      <div className="flex flex-col gap-2">
        {/* Tabs Bar: 2개 이상의 버전이 있을 때만 노출 */}
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
      </div>

      <textarea
        className="w-full h-[120px] resize-none outline-none text-sm text-neutral-800 placeholder-neutral-300 bg-transparent custom-scrollbar"
        placeholder="Enter your prompt for re-generation..."
        value={currentVersion?.text || ''}
        onChange={(e) => {
          const val = e.target.value;
          useStore.getState().updatePromptTextWithBranching(id, currentVersionId, val);
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
            disabled={!(currentVersion?.text || '').trim() || isEnhancing}
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
            disabled={!(currentVersion?.text || '').trim()}
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
