import { memo, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { EXPERTS } from '../../lib/experts';
import { 
  ArrowRight, Sparkles, Bot, MessageSquare,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, Trash2, Image as ImageIcon
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn, sanitize, sanitizeShort } from '../../lib/utils';
import { 
  TurnGroupNodeData, ExpertTurnData, isTurnGroupNode, 
  isPromptNode, PromptNodeData, getPromptNodeData 
} from '../../types/nodes';
import { GEMS_PALETTE } from '../../store/useStore';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, Bot
};

export const TurnGroupNode = memo(({ id, data, selected }: NodeProps<Node<TurnGroupNodeData>>) => {
  const [prompt, setPrompt] = useState('');
  const [promptImage, setPromptImage] = useState<string | undefined>(undefined);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const selectedNodeId = useStore(state => state.selectedNodeId);
  const selectedNodeIds = useStore(state => state.selectedNodeIds);

  const palette = (data.versionColor && GEMS_PALETTE) ? GEMS_PALETTE.find(p => p.main === data.versionColor) : null;
  const bgColor = palette ? palette.pale : '#F9FAFB';
  const accentColor = palette ? palette.main : '#000000';

  const isFocusSelected = useMemo(() => {
    return selectedNodeId === id || (selectedNodeId && selectedNodeId.startsWith(id + '::'));
  }, [selectedNodeId, id]);

  const isSingleNodeSelected = useMemo(() => {
    return selectedNodeIds.length === 1 && selectedNodeIds[0] === id;
  }, [selectedNodeIds, id]);

  const handleEnhance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(prompt || '').trim() || isEnhancing) return;
    setIsEnhancing(true);
    // Note: implementation details for enhancePromptForRegenerate might vary, 
    // but we'll stick to the core logic.
    setIsEnhancing(false);
  };

  const roleTitles: Record<string, string> = {
    thesis: '제안 (THESIS)',
    antithesis: '반박 (ANTITHESIS)',
    support: '검증 (SUPPORT)',
    synthesis: '통합 (SYNTHESIS)',
  };

  const handleExpertClick = (e: React.MouseEvent, turnData: ExpertTurnData) => {
    e.stopPropagation();
    if (!turnData.expertId) return; // 아직 스켈레톤 상태일 때는 클릭 방지
    const state = useStore.getState();
    state.setSelectedNodeId(`${id}::${turnData.role}`);
    state.setRightPanelOpen(true);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPromptImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processImageFile(e.target.files[0]);
  };

  const renderExpert = (turnData: ExpertTurnData) => {
    const role = turnData.role;
    const E = EXPERTS.find((e) => e.id === turnData?.expertId);
    
    if (!E) {
      return (
        <div
          key={role}
          title={roleTitles[role]}
          className="w-11 h-11 rounded-[18px] bg-neutral-100 flex items-center justify-center border border-neutral-200 shadow-inner animate-pulse"
        >
          <div className="w-3 h-3 rounded-full bg-neutral-300" />
        </div>
      );
    }

    const isExpertSelected = selectedNodeId === `${id}::${role}`;
    const ExpertIcon = IconMap[E.iconName || 'Bot'] || Bot;

    return (
      <div
        key={role}
        onClick={(e) => handleExpertClick(e, turnData)}
        title={roleTitles[role]}
        className={cn(
          "w-11 h-11 rounded-[18px] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 group animate-in fade-in zoom-in-50 duration-300",
          isExpertSelected 
            ? "bg-black text-white shadow-xl" 
            : "bg-white text-neutral-400 hover:text-black border border-neutral-100"
        )}
      >
        <ExpertIcon className="w-[18px] h-[18px]" />
      </div>
    );
  };

  return (
    <div
      className={cn(
        'w-[540px] rounded-[40px] p-3 shadow-2xl relative transition-all duration-300 border border-neutral-200 flex items-stretch gap-1 cursor-default hover:ring-2 hover:ring-black/20',
        (selected || isFocusSelected || isSingleNodeSelected) && 'border-black ring-2 ring-black/20'
      )}
      style={{ backgroundColor: bgColor }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />

      <div className="flex flex-col gap-2 justify-center pl-2 pr-1 py-4">
        {data.thesis && renderExpert(data.thesis)}
        {data.antithesis && renderExpert(data.antithesis)}
        {data.support && renderExpert(data.support)}
        {data.synthesis && renderExpert(data.synthesis)}
      </div>

      {/* Right Column: Final Plan Card */}
      <div 
        className="flex-1 bg-white rounded-[32px] p-6 shadow-sm border border-neutral-100 flex flex-col min-w-0 cursor-pointer hover:shadow-md transition-all min-h-[280px]"
        onClick={() => {
          const state = useStore.getState();
          state.setSelectedNodeId(id);
          
          // 부모 프롬프트 노드 탐색 및 탭 전환 (1:1 매칭)
          const edge = state.edges.find(e => e.target === id);
          if (edge) {
            const parentNode = state.nodes.find(n => n.id === edge.source);
            if (parentNode && isPromptNode(parentNode)) {
              const pData = getPromptNodeData(parentNode.data);
              const edgeColor = (edge.data as any)?.color;
              const matchingVersion = (pData.versions || []).find(v => v.color === edgeColor);
              if (matchingVersion) {
                state.updateNodeData(parentNode.id, { currentVersionId: matchingVersion.id });
              }
            }
          }
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-black opacity-30">FINAL ARGUMENT</span>
          <Trash2 
            className="h-3.5 w-3.5 text-neutral-400 hover:text-black transition-colors cursor-pointer" 
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().deleteNode(id);
            }}
          />
        </div>
        
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 mb-6">
            <div 
              className="p-1.5 rounded-lg shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Bot className="h-3 w-3 text-white" />
            </div>
            <h2 className="text-[13px] font-black tracking-tight text-neutral-900 uppercase">Final Opinion Report</h2>
          </div>
          
          <div className="relative pl-6 border-l border-neutral-100">
            <p className="text-[12.5px] leading-[1.65] font-medium text-neutral-900 line-clamp-none">
              {/* [G3 FIX] shortFinalOutput 우선 사용. 없을 경우 finalOutput 200자 truncate로 전문 노출 방지 */}
              {sanitizeShort(
                data.shortFinalOutput
                  ? data.shortFinalOutput
                  : (data.finalOutput || '').length > 200
                    ? (data.finalOutput || '').slice(0, 200).trimEnd() + '...'
                    : (data.finalOutput || '')
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 우측 상단 팝업 Prompt UI (오직 단일 그룹 노드 선택 시에만 노출) */}
      <div 
        className={cn(
          "absolute top-0 -right-80 w-[300px] bg-white rounded-[32px] p-5 shadow-2xl border border-neutral-200 transition-all duration-300 z-50 flex flex-col gap-4 ring-1 ring-black/5",
          isSingleNodeSelected
            ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-black uppercase tracking-widest text-black flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              New Strategy
            </h3>
            <label
              className="cursor-pointer text-neutral-400 hover:text-blue-500 transition-colors p-1"
              title="Upload Support Image"
            >
              <ImageIcon className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
          
          {promptImage && (
            <div className="relative w-full rounded-lg overflow-hidden group/img nodrag">
              <img src={promptImage} alt="Attached" className="h-20 w-full object-cover transition-transform duration-300" />
              <button 
                onClick={() => setPromptImage(undefined)}
                className="absolute top-1 right-1 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50/30 p-1">
            <textarea
              id={`input-regen-${id}`}
              name={`textarea-regen-${id}`}
              className="w-full h-[120px] resize-none outline-none text-[13px] text-neutral-800 placeholder-neutral-400 bg-transparent custom-scrollbar p-3 pt-2"
              placeholder="Enter instructions for regeneration..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pr-1">
            <button
              className={cn(
                'h-9 w-9 flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-all shadow-sm active:scale-95',
                isEnhancing && 'animate-pulse'
              )}
              onClick={handleEnhance}
              disabled={isEnhancing}
              title="Enhance Prompt"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              className="h-10 w-10 flex items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-all shadow-xl active:scale-90 disabled:opacity-50"
              disabled={!prompt.trim() && !promptImage}
              onClick={() => {
                useStore.getState().createPromptAndRegenerate(id, prompt, promptImage);
                setPrompt('');
                setPromptImage(undefined);
              }}
              title="Re-generate Strategy"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
