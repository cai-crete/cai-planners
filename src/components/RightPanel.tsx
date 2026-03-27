import { memo, useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { EXPERTS } from '../lib/experts';
import { cn, sanitize } from '../lib/utils';
import { 
  X, Copy, ChevronRight, Settings, 
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { summarizeNote } from '../lib/enhanceNote';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

export const RightPanel = memo(() => {
  const {
    isRightPanelOpen,
    toggleRightPanel,
    selectedNodeId,
    setSelectedNodeId,
    nodes,
    autoExpertMode,
    setAutoExpertMode,
    selectedExpertIds,
    toggleExpertSelection,
  } = useStore();

  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExpertsOpen, setIsExpertsOpen] = useState(false);

  // selectedNodeId가 "groupId::role" 형태인지 파싱
  const parsedSelection = useMemo(() => {
    if (!selectedNodeId) return { groupId: null, role: null };
    if (selectedNodeId.includes('::')) {
      const [gId, role] = selectedNodeId.split('::');
      return { groupId: gId, role };
    }
    return { groupId: selectedNodeId, role: null };
  }, [selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === parsedSelection.groupId || n.id === selectedNodeId),
    [nodes, selectedNodeId, parsedSelection.groupId]
  );

  const isTurnGroup = selectedNode?.type === 'turnGroup';

  const stickyFullText = !isTurnGroup
    ? ((selectedNode?.data as any)?.fullText || (selectedNode?.data as any)?.text)
    : undefined;

  useEffect(() => {
    if (stickyFullText !== undefined) setEditedText(stickyFullText);
  }, [selectedNodeId, stickyFullText]);

  const handleSave = async () => {
    if (!selectedNode || !editedText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const summary = await summarizeNote(editedText);
      useStore.getState().updateNodeData(selectedNode.id, { text: summary, fullText: editedText });
    } catch {
      alert('요약 생성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const isModified = stickyFullText !== undefined && editedText !== stickyFullText;

  const roleTitles: Record<string, string> = {
    thesis: '제안 (THESIS)',
    antithesis: '반박 (ANTITHESIS)',
    support: '검증 (SUPPORT)',
    synthesis: '통합 (SYNTHESIS)',
  };

  /** 그룹 노드에서 특정 전문가가 선택되었을 때 렌더링 (B&W) */
  const renderSingleExpert = () => {
    const role = parsedSelection.role as 'thesis' | 'antithesis' | 'synthesis' | 'support';
    const turnData = (selectedNode?.data as any)[role];
    if (!turnData) return null;
    const expert = EXPERTS.find((e) => e.id === turnData.expertId);
    if (!expert) return null;

    const ExpertIcon = IconMap[expert.iconName || 'Bot'] || Bot;
    
    return (
      <div className="space-y-6 pt-2 h-full flex flex-col">
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50">
          <div className="h-12 w-12 rounded-lg bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shadow-sm">
            <ExpertIcon className="h-6 w-6 text-black" />
          </div>
          <div>
            <div className="text-[14px] font-black text-black uppercase tracking-tight">{expert.name}</div>
            <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{roleTitles[role]}</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 leading-[1.8] text-[13px] text-neutral-800 font-medium whitespace-pre-wrap">
          {sanitize(turnData.fullContent)}
        </div>

        <div className="pt-4 border-t border-neutral-100 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(turnData.fullContent)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[12px] font-black text-black hover:bg-neutral-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" /> Copy Text
          </button>
        </div>
      </div>
    );
  };

  /** 그룹 전체 토론 로그 렌더링 (B&W Debate Log Style 복구) */
  const renderFullDebateLog = () => {
    const data = selectedNode?.data as any;
    if (!data) return null;

    const roles: Array<'thesis' | 'antithesis' | 'support' | 'synthesis'> = ['thesis', 'antithesis', 'support', 'synthesis'];
    
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
          {/* 8.2 Workflow Simulation Log */}
          {data.workflowSimulationLog && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
                8.2 Workflow Simulation Log
              </h3>
              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-100 italic leading-[1.8] text-[12px] text-neutral-600 font-medium">
                "{sanitize(data.workflowSimulationLog)}"
              </div>
            </div>
          )}

          {/* Expert Strategic Turns */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
              Strategic Debate Log
            </h3>
            {roles.map((role) => {
              const turnData = data[role];
              if (!turnData) return null;
              const expert = EXPERTS.find((e) => e.id === turnData.expertId);
              if (!expert) return null;
              const ExpertIcon = IconMap[expert.iconName || 'Bot'] || Bot;

              return (
                <div key={role} className="space-y-4 pb-8 border-b border-neutral-50 last:border-0 group transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-white border border-neutral-200 flex items-center justify-center overflow-hidden">
                      <ExpertIcon className="h-4 w-4 text-black" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-black text-black uppercase tracking-tight">
                        [{expert.name} — {roleTitles[role]}]
                      </span>
                      <span className="text-[9px] font-black text-neutral-300 uppercase tracking-tighter">
                        {role === 'thesis' ? 'Strategic Proposal' : role === 'antithesis' ? 'Critical Refutation' : role === 'support' ? 'Empirical Validation' : 'Integrated Synthesis'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] leading-[1.8] text-neutral-800 font-medium whitespace-pre-wrap pl-11">
                    {sanitize(turnData.fullContent)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 8.3 Final Strategic Output (Integrated) */}
          <div className="space-y-4 pt-4">
             <h3 className="text-[10px] font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
               <Check className="h-4 w-4 bg-black text-white rounded p-0.5" /> 8.3 Final Strategic Output
             </h3>
              <div className={[
                'prose prose-neutral max-w-none text-black select-text whitespace-pre-wrap',
                '[&_h1]:text-[16px] [&_h1]:font-black [&_h1]:mb-6 [&_h1]:mt-8 [&_h1]:pb-4 [&_h1]:border-b-2 [&_h1]:border-black',
                '[&_h2]:text-[14px] [&_h2]:font-black [&_h2]:mt-6 [&_h2]:mb-4 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-["■"] before:[&_h2]:text-black before:[&_h2]:text-[10px]',
                '[&_h3]:text-[13px] [&_h3]:font-black [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-neutral-900',
                '[&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:mb-4 [&_p]:text-neutral-900 [&_p]:font-medium',
                '[&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4',
                '[&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-black',
                '[&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:marker:font-black',
                '[&_li]:text-[12px] [&_li]:leading-[1.8] [&_li]:mb-2 [&_li]:text-neutral-900',
                '[&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:rounded-r-lg',
                '[&_hr]:my-8 [&_hr]:border-neutral-300'
              ].join(' ')}>
                <Markdown>{sanitize(data.finalOutput || '')}</Markdown>
              </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-6 border-t border-neutral-100">
          <button
            onClick={() => {
              const fullTextContent = `[8.2 Log]\n${data.workflowSimulationLog}\n\n[Debate]\n${roles.map(r => `[${EXPERTS.find(e => e.id === data[r]?.expertId)?.name}] ${data[r]?.fullContent}`).join('\n\n')}\n\n[8.3 Output]\n${data.finalOutput}`.trim();
              navigator.clipboard.writeText(fullTextContent);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] font-black text-black hover:bg-neutral-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" /> Copy Full Log
          </button>
        </div>
      </div>
    );
  };

  /** Final Plan 렌더링 - 8.3 & 8.4 전문 통합 출력 (간격 축소) */
  const renderFinalPlan = () => {
    const data = selectedNode?.data as any;
    if (!data) return null;

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
          <div className="space-y-2">
            <div className={[
              'prose prose-neutral max-w-none text-black select-text whitespace-pre-wrap',
              '[&_h1]:text-[15px] [&_h1]:font-black [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:pb-2 [&_h1]:border-b-2 [&_h1]:border-black',
              '[&_h2]:text-[13px] [&_h2]:font-black [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-["■"] before:[&_h2]:text-black before:[&_h2]:text-[10px]',
              '[&_h3]:text-[12px] [&_h3]:font-black [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-neutral-900',
              '[&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:mb-2 [&_p]:text-neutral-900 [&_p]:font-medium',
              '[&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4',
              '[&_ul]:mb-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-black',
              '[&_ol]:mb-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:marker:font-black',
              '[&_li]:text-[12px] [&_li]:leading-[1.8] [&_li]:mb-1 [&_li]:text-neutral-900',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:rounded-r-lg',
              '[&_hr]:my-4 [&_hr]:border-neutral-300'
            ].join(' ')}>
              <Markdown>{sanitize(data.finalOutput || '').replace(/### 8\.3 Final Strategic Output/g, '')}</Markdown>
              {data.transparencyReport && (
                <div className="mt-6 pt-4 border-t border-neutral-100">
                  <h2 className="text-[13px] font-black mt-2 mb-2 flex items-center gap-2 before:content-['■'] before:text-black before:text-[10px]">
                    Metacognitive Transparency
                  </h2>
                  <ul className="mb-2 pl-5 list-disc marker:text-black">
                    <li className="text-[12px] leading-[1.8] mb-1 text-neutral-900">
                      <strong>Self Healing Log:</strong> {data.transparencyReport.selfHealingLog}
                    </li>
                    <li className="text-[12px] leading-[1.8] mb-1 text-neutral-900">
                      <strong>Truthfulness Check:</strong> {data.transparencyReport.truthfulnessCheck}
                    </li>
                    <li className="text-[12px] leading-[1.8] mb-1 text-neutral-900">
                      <strong>Real Impact:</strong> {data.transparencyReport.realImpact}
                    </li>
                    <li className="text-[12px] leading-[1.8] mb-1 text-neutral-900">
                      <strong>Next Action:</strong> {data.transparencyReport.nextActionSuggestion}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-100 mt-auto">
          <button
            onClick={() => {
              const report = data.transparencyReport;
              const repText = report ? `\n\n[Transparency Report]\n- Self Healing: ${report.selfHealingLog}\n- Truthfulness: ${report.truthfulnessCheck}\n- Real Impact: ${report.realImpact}\n- Next Action: ${report.nextActionSuggestion}` : '';
              navigator.clipboard.writeText((data.finalOutput || '').replace(/### 8\.3 Final Strategic Output/g, '').trim() + repText);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] font-black text-black hover:bg-neutral-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" /> Copy Final Plan
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'absolute top-4 bottom-4 z-40 transition-all duration-300 ease-in-out flex items-start',
        isRightPanelOpen ? 'right-4' : '-right-80'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleRightPanel}
        className="mr-4 mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
        title={isRightPanelOpen ? 'Close Panel' : 'Open Panel'}
      >
        {isRightPanelOpen ? <ChevronRight className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
      </button>

      {/* Panel */}
      <div className="w-80 h-full bg-white/90 backdrop-blur-xl shadow-2xl border border-neutral-200 rounded-2xl flex flex-col overflow-hidden pt-4">
        {/* Workspace Title Removed */}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Node Detail Section */}
          {selectedNode && (
            <div className="border-b border-neutral-100">
              <div className="flex items-center justify-between p-4 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {isTurnGroup
                    ? parsedSelection.role
                      ? parsedSelection.role === 'finalPlan' ? 'FINAL PLAN' : roleTitles[parsedSelection.role]
                      : 'DEBATE LOG'
                    : 'NOTE'}
                </h3>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="rounded-md p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-4 pb-4 h-[calc(100vh-320px)] min-h-[400px]">
                {isTurnGroup ? (
                  parsedSelection.role 
                    ? (parsedSelection.role === 'finalPlan' ? renderFinalPlan() : renderSingleExpert()) 
                    : renderFullDebateLog()
                ) : (
                  /* 일반 스티키 노드 */
                  <div className="space-y-3 flex flex-col h-full">
                    {(selectedNode.data as any).imageUrl && (
                      <img
                        src={(selectedNode.data as any).imageUrl}
                        alt="Sticky Note"
                        className="w-full rounded-md border border-neutral-200 object-cover max-h-32"
                      />
                    )}
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full flex-1 resize-none rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-800 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 custom-scrollbar"
                      placeholder="내용을 입력하세요..."
                    />
                    <div className="mt-2 flex justify-end h-[32px]">
                      {isModified && (
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="w-[calc(50%-0.25rem)] flex items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors disabled:bg-neutral-400"
                        >
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expert Settings */}
          <div className="p-4 border-t border-neutral-100">
            <div
              className="flex items-center justify-between mb-2 cursor-pointer"
              onClick={() => setIsExpertsOpen(!isExpertsOpen)}
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" /> Experts
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAutoExpertMode(!autoExpertMode);
                  }}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider transition-colors border',
                    autoExpertMode
                      ? 'bg-neutral-900 text-white border-black'
                      : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                  )}
                >
                  Auto: {autoExpertMode ? 'ON' : 'OFF'}
                </button>
                <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', isExpertsOpen ? 'rotate-180' : '')} />
              </div>
            </div>

            {isExpertsOpen && (
              <div className={cn('mt-2 space-y-1', autoExpertMode ? 'opacity-50 pointer-events-none' : '')}>
                {EXPERTS.map((expert) => {
                  const isSelected = selectedExpertIds.includes(expert.id);
                  const ExpertIcon = IconMap[expert.iconName || 'Bot'] || Bot;
                  
                  return (
                    <div key={expert.id} className="relative group">
                      <label
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors border',
                          isSelected ? 'bg-white border-neutral-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-neutral-50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            isSelected ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => toggleExpertSelection(expert.id)}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="h-5 w-5 rounded-md bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                            <ExpertIcon className="h-3 w-3 text-black" />
                          </div>
                          <span className="text-[11px] font-bold text-neutral-700 truncate">{expert.name}</span>
                        </div>
                        
                        {/* Info Icon with Tooltip */}
                        <div className="relative group/info ml-auto">
                          <Info className="h-3.5 w-3.5 text-neutral-300 group-hover/info:text-black transition-colors" />
                          <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-neutral-900 text-white text-[10px] rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/info:opacity-100 transition-opacity z-50 leading-relaxed font-medium">
                            <div className="font-black text-neutral-400 mb-1 border-b border-neutral-800 pb-1 uppercase tracking-wider">
                              {expert.name} Framework
                            </div>
                            {(expert as any).framework || expert.description}
                            <div className="absolute -bottom-1 right-2 w-2 h-2 bg-neutral-900 rotate-45" />
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
