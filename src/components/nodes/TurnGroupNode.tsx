import { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { EXPERTS } from '../../lib/experts';
import { 
  ArrowRight, Sparkles, Bot, MessageSquare,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { enhancePromptForRegenerate } from '../../lib/gemini';
import { useStore } from '../../store/useStore';
import { cn, sanitize } from '../../lib/utils';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

export interface ExpertTurnData {
  expertId: string;
  role: 'thesis' | 'antithesis' | 'synthesis' | 'support';
  keywords?: string[];
  shortContent: string;
  fullContent: string;
}

export interface TurnGroupNodeData extends Record<string, unknown> {
  turn: number;
  metacognitiveDefinition: {
    selectedMode: string;
    projectDefinition: string;
    activeSquadReason: string;
  };
  workflowSimulationLog: string;
  thesis: ExpertTurnData;
  antithesis: ExpertTurnData;
  synthesis: ExpertTurnData;
  support: ExpertTurnData;
  shortFinalOutput: string;
  finalOutput: string;
  transparencyReport: {
    selfHealingLog: string;
    truthfulnessCheck: string;
    realImpact: string;
    nextActionSuggestion: string;
  };
}

export const TurnGroupNode = memo(({ id, data, selected }: NodeProps<Node<TurnGroupNodeData>>) => {
  const [prompt, setPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await enhancePromptForRegenerate(prompt);
      setPrompt(enhanced);
    } catch (e) {
      console.error('Enhance failed', e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const roleTitles: Record<string, string> = {
    thesis: '제안 (THESIS)',
    antithesis: '반박 (ANTITHESIS)',
    support: '검증 (SUPPORT)',
    synthesis: '통합 (SYNTHESIS)',
  };

  const handleExpertClick = (e: React.MouseEvent, turnData: ExpertTurnData) => {
    e.stopPropagation(); // 복구: 부모 전파를 막아 개별 뷰가 유지되게 함
    const state = useStore.getState();
    state.setSelectedNodeId(`${id}::${turnData.role}`);
    state.setRightPanelOpen(true);
  };

  const renderExpert = (turnData: ExpertTurnData, theme: 'light' | 'dark') => {
    const E = EXPERTS.find((e) => e.id === turnData?.expertId);
    if (!E) return null;

    const role = turnData.role;
    const content = turnData.shortContent;
    const turn = data.turn;
    const title = roleTitles[role] || '';

    const ExpertIcon = IconMap[E.iconName || 'Bot'] || Bot;

    return (
      <div
        className={cn(
          "p-3 rounded-2xl border-2 transition-all cursor-pointer hover:ring-2 hover:ring-black shadow-sm",
          theme === 'dark' ? "bg-black border-neutral-800 text-white" : "bg-white border-neutral-100 text-black"
        )}
        onClick={(e) => handleExpertClick(e, turnData)}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center overflow-hidden shadow-sm",
            theme === 'dark' ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
          )}>
            <ExpertIcon className={cn("w-5 h-5", theme === 'dark' ? "text-white" : "text-black")} />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <h4 className="font-black text-[12px] uppercase tracking-tight truncate">
                {E.name}
              </h4>
              <span className="text-[8px] font-black text-neutral-400 bg-neutral-50 px-1 py-0.5 rounded border border-neutral-100">
                turn {turn}
              </span>
            </div>
            <div className="text-[9px] font-black text-neutral-400 flex flex-wrap gap-1.5 mb-0.5">
              {(turnData.keywords || []).slice(0, 5).map((kw) => (
                <span key={kw}>#{kw}</span>
              ))}
            </div>
            <span className="block text-[9px] font-black text-neutral-500 uppercase tracking-widest">
              {title} 
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'w-[960px] rounded-3xl bg-[#EBEBEB] p-5 shadow-xl relative transition-all duration-300 border border-neutral-300 flex gap-5 cursor-pointer hover:ring-4 hover:ring-blue-500/30',
        selected && 'ring-4 ring-blue-500/30'
      )}
      onClick={() => {
        const state = useStore.getState();
        state.setSelectedNodeId(`${id}::finalPlan`);
        state.setRightPanelOpen(true);
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* 좌측 열: 4인 전문가 */}
      <div className="flex flex-col gap-3 w-[450px] shrink-0">
        {data.thesis && renderExpert(data.thesis, 'light')}
        {data.antithesis && renderExpert(data.antithesis, 'light')}
        {data.support && renderExpert(data.support, 'light')}
        {data.synthesis && renderExpert(data.synthesis, 'dark')}
      </div>

      {/* 우측 열: Final Plan만 존재 */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Final Plan */}
        <div className="flex-1 flex flex-col h-full hover:ring-2 hover:ring-neutral-200 rounded-xl transition-all">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-2 pl-1">
            FINAL PLAN
          </h3>
          <div className="flex-1 bg-white rounded-xl p-5 text-xs font-sans overflow-y-auto custom-scrollbar shadow-sm leading-relaxed text-neutral-800 line-clamp-none">
            {/* Final Plan Preview (8.3) */}
            <div className="mt-8 pt-8 border-t-2 border-neutral-100 px-2 pb-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1 rounded bg-black">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-black">Final Strategic Plan</span>
              </div>
              <div className="w-full">
                <p className="text-[12px] leading-[1.8] font-medium whitespace-pre-wrap text-neutral-900 border-l-2 border-neutral-300 pl-3">
                  {sanitize((data.shortFinalOutput as string) || (data.finalOutput as string) || '')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 우측 상단 팝업 Prompt UI (그룹 혹은 자식 노드 선택 시 보임) */}
      <div 
        className={cn(
          "absolute top-0 -right-80 w-[300px] bg-white rounded-2xl p-4 shadow-2xl border-2 border-blue-500 transition-all duration-300 z-50 flex flex-col gap-3",
          (selected || useStore.getState().selectedNodeId?.startsWith(id + '::'))
            ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex flex-col">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            New Strategy Prompt
          </h3>
          <div className="flex-1 relative rounded-xl border border-neutral-200 bg-neutral-50 p-2">
            <textarea
              className="w-full h-[100px] resize-none outline-none text-sm text-neutral-800 placeholder-neutral-400 bg-transparent custom-scrollbar pb-10"
              placeholder="Enter instructions for the next regeneration..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <button
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 transition-colors shadow-sm disabled:opacity-40',
                  isEnhancing && 'animate-pulse'
                )}
                onClick={handleEnhance}
                disabled={!prompt.trim() || isEnhancing}
                title="Enhance Prompt"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <button
                className="h-8 pl-3 pr-4 flex items-center justify-center gap-1.5 rounded-md bg-black text-white hover:bg-neutral-800 transition-colors shadow-md disabled:opacity-50"
                onClick={() => {
                  if (prompt.trim()) {
                    useStore.getState().createPromptAndRegenerate(id, prompt);
                  }
                }}
                disabled={!prompt.trim()}
                title="Re-generate Strategy"
              >
                <ArrowRight className="h-4 w-4" />
                <span className="text-[11px] font-bold">Generate</span>
              </button>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-neutral-400 font-medium text-center">
          그룹을 다시 선택하면 입력한 내용이 이 박스에 보존됩니다.
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
