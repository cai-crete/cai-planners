import { memo, useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { EXPERTS } from '../lib/experts';
import { cn, sanitize } from '../lib/utils';
import { X, Copy, ChevronRight, Settings, 
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, LayoutPanelLeft
} from 'lucide-react';
import Markdown from 'react-markdown';
import { summarizeNote } from '../lib/enhanceNote';
import { generateDiscussion } from '../lib/gemini';

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
    isGenerating,
    setIsGenerating,
    addNode,
    currentMode,
    generationTurn,
    setGenerationTurn,
  } = useStore();

  const [editedText, setEditedText] = useState('');
  const [dashboardNote, setDashboardNote] = useState('');
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

  const handleDashboardGenerate = async () => {
    if (!dashboardNote.trim() || isGenerating) return;
    if (generationTurn >= 3) {
      alert('최대 턴(3턴)에 도달했습니다. 캔버스를 초기화 한 후 다시 시도해 주세요.');
      return;
    }
    
    setIsGenerating(true);
    try {
      const result = await generateDiscussion(dashboardNote, currentMode, selectedExpertIds);
      const currentTurn = generationTurn + 1;
      const groupId = `node-group-${Date.now()}`;
      
      // 화면 중앙 부근에 스폰
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2 - 100;

      addNode({
        id: groupId,
        type: 'turnGroup',
        position: { x: cx - 480, y: cy }, // 그룹 노드가 960px 이므로 절반 빼줌
        data: {
          turn: currentTurn,
          thesis: result.thesis,
          antithesis: result.antithesis,
          synthesis: result.synthesis,
          support: result.support,
          finalOutput: result.finalOutput,
          shortFinalOutput: result.shortFinalOutput,
          workflowSimulationLog: result.workflowSimulationLog,
          metacognitiveDefinition: result.metacognitiveDefinition,
          transparencyReport: result.transparencyReport,
        },
      } as any);

      setGenerationTurn(currentTurn);
      setDashboardNote(''); // 입력 후 비우기
    } catch (error) {
      console.error('Generation failed:', error);
      alert('생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
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
              <div className="prose prose-neutral max-w-none text-black select-text whitespace-pre-wrap [&_h1]:text-[16px] [&_h1]:font-black [&_h1]:mb-6 [&_h1]:mt-8 [&_h1]:pb-4 [&_h1]:border-b-2 [&_h1]:border-black [&_h2]:text-[14px] [&_h2]:font-black [&_h2]:mt-6 [&_h2]:mb-4 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-['■'] before:[&_h2]:text-black before:[&_h2]:text-[10px] [&_h3]:text-[13px] [&_h3]:font-black [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-neutral-900 [&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:mb-4 [&_p]:text-neutral-900 [&_p]:font-medium [&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4 [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-black [&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:marker:font-black [&_li]:text-[12px] [&_li]:leading-[1.8] [&_li]:mb-2 [&_li]:text-neutral-900 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_hr]:my-8 [&_hr]:border-neutral-300">
                <Markdown>{sanitize(data.finalOutput || '')}</Markdown>
              </div>
          </div>

          {/* 8.4 Metacognitive Transparency */}
          {data.transparencyReport && (
            <div className="space-y-4 pt-6 border-t border-neutral-100">
              <h3 className="text-[10px] font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
               <Shield className="h-4 w-4 bg-black text-white rounded p-0.5" /> 8.4 Metacognitive Transparency
              </h3>
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
      <div className="w-[280px] h-full bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.02)] border-l border-neutral-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full relative">
          
          {/* 1. Header (Shared) */}
          <div className="p-4 border-b border-neutral-50 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2 px-4 py-2 border border-neutral-100 rounded-full cursor-pointer hover:bg-neutral-50 transition-colors shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-800">PLANNERS</span>
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            </div>
            <div className="flex items-center gap-3">
              <LayoutPanelLeft className="h-4 w-4 text-neutral-300 cursor-pointer hover:text-black transition-colors" />
              {selectedNode && (
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="rounded-full p-1 hover:bg-neutral-50 text-neutral-300 hover:text-neutral-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Main Content (Note/Debate Log) */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedNode && isTurnGroup ? (
              /* Debate Log View (TurnGroup selected) */
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {parsedSelection.role
                      ? parsedSelection.role === 'finalPlan' ? 'FINAL PLAN' : roleTitles[parsedSelection.role]
                      : 'DEBATE LOG'}
                  </h3>
                </div>
                <div className="h-full min-h-[500px]">
                  {parsedSelection.role 
                    ? (parsedSelection.role === 'finalPlan' ? renderFinalPlan() : renderSingleExpert()) 
                    : renderFullDebateLog()}
                </div>
              </div>
            ) : (
              /* Note / Generation View (Dashboard or Sticky selected) */
              <div className="flex flex-col flex-1">
                {/* Note Section */}
                <div className="p-4 border-b border-neutral-50 flex flex-col gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-400">
                    CODE
                  </span>
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm relative overflow-hidden group">
                    <textarea
                      value={selectedNode && !isTurnGroup ? (selectedNode.data as any).text : dashboardNote}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (selectedNode && !isTurnGroup) {
                          useStore.getState().updateNodeData(selectedNode.id, { text: val });
                        } else {
                          setDashboardNote(val);
                        }
                      }}
                      className="w-full h-32 p-4 bg-transparent text-[12px] font-medium leading-relaxed text-neutral-800 placeholder-neutral-300 resize-none outline-none custom-scrollbar"
                      placeholder="Tell me your project, and I'll start the best expert team for you right away."
                    />
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Copy className="h-3.5 w-3.5 text-neutral-300 hover:text-black" />
                    </div>
                  </div>
                </div>

                {/* Experts Section */}
                <div className="p-4 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-400">EXPERTS</span>
                    <button
                      onClick={() => setAutoExpertMode(!autoExpertMode)}
                      className={cn(
                        'text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors border',
                        autoExpertMode ? 'bg-black text-white border-black' : 'bg-white text-neutral-300 border-neutral-100'
                      )}
                    >
                      Auto: {autoExpertMode ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  
                  <div className={cn('flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1', autoExpertMode ? 'opacity-40 pointer-events-none' : '')}>
                    {EXPERTS.map((expert, idx) => {
                      const isSelected = selectedExpertIds.includes(expert.id);
                      
                      return (
                        <div
                          key={expert.id}
                          onClick={() => toggleExpertSelection(expert.id)}
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all w-full select-none",
                            isSelected ? "border-neutral-200 bg-white shadow-sm" : "border-neutral-50 bg-neutral-50/30 hover:bg-neutral-50"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-full shrink-0 border border-neutral-100",
                            isSelected ? "bg-white" : "bg-transparent text-neutral-200"
                          )}>
                            <div className="w-3.5 h-3.5 rounded-full border border-current opacity-20" />
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold tracking-tight flex-1 truncate",
                            isSelected ? "text-neutral-800" : "text-neutral-400"
                          )}>
                            AGENT {idx + 1} <span className="mx-1 opacity-20">|</span> <span className="font-medium text-[9px]">[{expert.name}]</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* GENERATE Footer (Shared between Dashboard & Sticky) */}
                <div className="p-4 border-t border-neutral-50 bg-white">
                  <button
                    onClick={async () => {
                      const currentText = (selectedNode && !isTurnGroup) ? (selectedNode.data as any).text : dashboardNote;
                      if (!currentText.trim() || isGenerating) return;
                      
                      setIsGenerating(true);
                      try {
                        const result = await generateDiscussion(currentText, currentMode, selectedExpertIds);
                        const currentTurn = generationTurn + 1;
                        const groupId = `node-group-${Date.now()}`;
                        
                        // 현재 선택된 노드의 우측, 혹은 화면 중앙
                        const spawnPos = selectedNode 
                          ? { x: selectedNode.position.x + 400, y: selectedNode.position.y - 100 }
                          : { x: window.innerWidth / 2 - 480, y: window.innerHeight / 2 - 200 };

                        addNode({
                          id: groupId,
                          type: 'turnGroup',
                          position: spawnPos,
                          data: {
                            turn: currentTurn,
                            thesis: result.thesis,
                            antithesis: result.antithesis,
                            synthesis: result.synthesis,
                            support: result.support,
                            finalOutput: result.finalOutput,
                            shortFinalOutput: result.shortFinalOutput,
                            workflowSimulationLog: result.workflowSimulationLog,
                            metacognitiveDefinition: result.metacognitiveDefinition,
                            transparencyReport: result.transparencyReport,
                          },
                        } as any);

                        // 노드가 선택된 상태였다면 연결도 추가
                        if (selectedNode) {
                          useStore.getState().onConnect({
                            source: selectedNode.id,
                            target: groupId,
                            sourceHandle: null,
                            targetHandle: null
                          });
                        }

                        setGenerationTurn(currentTurn);
                        if (!selectedNode) setDashboardNote('');
                      } catch (error) {
                        console.error('Generation failed:', error);
                        alert('생성에 실패했습니다.');
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    disabled={
                      isGenerating || 
                      (!dashboardNote.trim() && !(selectedNode && (selectedNode.data as any)?.text?.trim()))
                    }
                    className="w-full flex items-center justify-center py-4 bg-black text-white rounded-full font-black text-[13px] uppercase tracking-[0.25em] hover:bg-neutral-800 hover:shadow-xl transition-all disabled:bg-neutral-200 disabled:shadow-none active:scale-[0.98]"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : "GENERATE"}
                  </button>
                  <div className="text-[7.5px] text-center text-neutral-300 font-bold mt-4 tracking-[0.1em] uppercase">
                    © CRETE CO., LTD. 2025. ALL RIGHTS RESERVED.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
