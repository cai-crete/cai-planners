import { memo, useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { EXPERTS } from '../lib/experts';
import { cn, sanitize, sanitizeShort } from '../lib/utils';
import { X, Copy, ChevronRight, Settings, 
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, LayoutPanelLeft
} from 'lucide-react';
import Markdown from 'react-markdown';
import { summarizeNote } from '../lib/enhanceNote';
import { 
  generateDiscussion, generateSynapseSeed, convergeAndExtractSynapse 
} from '../lib/gemini';
import { 
  AppNode, TurnGroupNodeData, ExpertTurnData, isTurnGroupNode, 
  isPromptNode, PromptNodeData, StickyNodeData, isStickyNode, getPromptNodeData,
  isSynapseNode
} from '../types/nodes';
import { 
  GEMS_PALETTE, INITIAL_GRAY, LEGACY_RED, generateId 
} from '../store/useStore';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

export const RightPanel = memo(() => {
  const {
    isRightPanelOpen,
    toggleRightPanel,
    selectedNodeId,
    selectedNodeIds,
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
    rightPanelWidth,
    setRightPanelWidth
  } = useStore();

  const [editedText, setEditedText] = useState('');
  const [dashboardNote, setDashboardNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExpertsOpen, setIsExpertsOpen] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<string[]>([]);
  const [isResizing, setIsResizing] = useState(false);

  // [UI 혁신] 리사이징 로직
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // [정정] 마우스 위치(e.clientX)는 흰색 패널의 좌측 끝입니다.
      // 실제 컨테이너의 너비는 (마우스에서 우측 끝까지의 거리) + (좌측 버튼 영역의 너비 52px)가 되어야 합니다.
      const buttonOffset = 52; 
      const newWidth = (window.innerWidth - e.clientX - 16) + buttonOffset; 
      const maxWidth = window.innerWidth * 0.5;
      const minWidth = 284;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isResizing, setRightPanelWidth]);

  const toggleRoleExpansion = (role: string) => {
    setExpandedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const parsedSelection = useMemo(() => {
    if (!selectedNodeId) return { groupId: null, role: null };
    if (selectedNodeId.includes('::')) {
      const [gId, role] = selectedNodeId.split('::');
      return { groupId: gId, role };
    }
    return { groupId: selectedNodeId, role: null };
  }, [selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === (parsedSelection.groupId || selectedNodeId)),
    [nodes, selectedNodeId, parsedSelection.groupId]
  );

  const isTurnGroup = selectedNode?.type === 'turnGroup';

  const stickyFullText = !isTurnGroup && selectedNode && isStickyNode(selectedNode)
    ? (selectedNode.data as StickyNodeData).fullText || (selectedNode.data as StickyNodeData).text
    : undefined;

  useEffect(() => {
    if (stickyFullText !== undefined) setEditedText(stickyFullText);
  }, [selectedNodeId, stickyFullText]);

  const handleSave = async () => {
    if (!selectedNode || !(editedText || '').trim() || isSaving) return;
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
    if (!(dashboardNote || '').trim() || isGenerating) return;
    if (generationTurn >= 3) {
      alert('최대 턴(3턴)에 도달했습니다. 캔버스를 초기화 한 후 다시 시도해 주세요.');
      return;
    }
    
    setIsGenerating(true);
    setRightPanelWidth(window.innerWidth * 0.5);
    useStore.getState().setRightPanelOpen(true);
    
    const currentTurn = generationTurn + 1;
    const groupId = `node-group-${generateId()}`;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2 - 100;

    // [BUG FIX] DOM 네이티브 포커싱 유지 및 기존 선택 해제
    useStore.getState().setNodes(
      useStore.getState().nodes.map(n => ({ ...n, selected: false }))
    );

    // 즉시 노드 생성 (스트리밍 버퍼 역할)
    addNode({
      id: groupId,
      type: 'turnGroup',
      position: { x: cx - 480, y: cy },
      loading: true,
      selected: true,
      data: {
        turn: currentTurn,
        versionColor: INITIAL_GRAY,
      },
    } as any);

    // 즉시 생성된 노드를 포커싱하여 우측 패널에 스트리밍 로그가 보이게 함
    setSelectedNodeId(groupId);

    try {
      const result = await generateDiscussion(dashboardNote, currentMode, selectedExpertIds, {
        onSquadSelected: (squad) => {
          useStore.getState().updateNodeData(groupId, { ...squad });
        },
        onStreamChunk: (partial) => {
          useStore.getState().updateNodeData(groupId, { ...partial });
        }
      });
      
      useStore.getState().updateNodeData(groupId, { ...result, loading: false });
      setGenerationTurn(currentTurn);
      setDashboardNote('');
    } catch (error) {
      console.error('Generation failed:', error);
      useStore.getState().deleteNode(groupId);
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

  const renderSingleExpert = () => {
    const role = parsedSelection.role as 'thesis' | 'antithesis' | 'synthesis' | 'support';
    const turnData = isTurnGroup ? (selectedNode?.data as TurnGroupNodeData)?.[role] : null;
    if (!turnData) return null;
    const expert = EXPERTS.find((e) => e.id === turnData.expertId) || { 
      name: '분석 중...', 
      iconName: 'Bot' 
    };
    
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

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(turnData.keywords || []).map((kw: string) => (
                <span key={kw} className="px-2 py-0.5 bg-white border border-neutral-100 rounded text-[10px] font-black text-neutral-400">
                  #{kw}
                </span>
              ))}
            </div>
            <div className="p-4 bg-white border border-neutral-100 rounded-xl shadow-sm italic text-[13px] leading-relaxed text-neutral-900 border-l-4 border-l-black">
              "{sanitizeShort(turnData.shortContent)}"
            </div>
          </div>

          <div className="text-[13px] leading-[1.8] text-neutral-800 font-medium whitespace-pre-wrap">
            {sanitize(turnData.fullContent)}
          </div>
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

  const renderFullDebateLog = () => {
    const data = isTurnGroup ? (selectedNode?.data as TurnGroupNodeData) : null;
    if (!data) return null;

    const roles: Array<'thesis' | 'antithesis' | 'support' | 'synthesis'> = ['thesis', 'antithesis', 'support', 'synthesis'];
    
    return (
      <div className="flex flex-col bg-white">
        <div className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
              Discussion & Debate Log
            </h3>
            {roles.map((role) => {
              const turnData = data[role];
              if (!turnData) return null;
              const expert = EXPERTS.find((e) => e.id === turnData.expertId) || {
                name: '전문가 선발 중...',
                iconName: 'Bot'
              };
              const ExpertIcon = IconMap[expert.iconName || 'Bot'] || Bot;
              const isExpanded = expandedRoles.includes(role);

              return (
                <div key={role} className="space-y-3 pb-6 border-b border-neutral-50 last:border-0 group transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded bg-white border border-neutral-200 flex items-center justify-center overflow-hidden">
                        <ExpertIcon className="h-3.5 w-3.5 text-black" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-black uppercase tracking-tight">
                          {expert.name}
                        </span>
                        <span className="text-[9px] font-black text-neutral-300 uppercase tracking-tighter">
                          {roleTitles[role]}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleRoleExpansion(role)}
                      className="p-1 hover:bg-neutral-50 rounded transition-colors"
                    >
                      <ChevronDown className={cn("h-4 w-4 text-neutral-300 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  </div>

                  <div className="pl-9.5 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(turnData.keywords || []).map((kw: string) => (
                        <span key={kw} className="text-[9px] font-black text-neutral-400">
                          #{kw}
                        </span>
                      ))}
                    </div>
                    <p className="text-[12px] leading-relaxed text-neutral-700 font-medium italic">
                      "{sanitizeShort(turnData.shortContent)}"
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="pl-9.5 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-[12px] leading-[1.8] text-neutral-800 font-medium whitespace-pre-wrap border-l-2 border-neutral-100 pl-4 py-1">
                        {sanitize(turnData.fullContent)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 pt-2">
             <h3 className="text-[10px] font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
               <Check className="h-4 w-4 bg-black text-white rounded p-0.5" /> 8.3 Final Strategic Output
             </h3>
              <div className="compact-markdown prose prose-neutral max-w-none text-black select-text whitespace-normal [&_h1]:text-[16px] [&_h1]:font-black [&_h1]:pb-2 [&_h1]:border-b-2 [&_h1]:border-black [&_h2]:text-[14px] [&_h2]:font-black [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-['■'] before:[&_h2]:text-black before:[&_h2]:text-[10px] [&_h3]:text-[13px] [&_h3]:font-black [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-neutral-900 [&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:text-neutral-900 [&_p]:font-medium [&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4 [&_ul]:list-disc [&_ul]:marker:text-black [&_ol]:list-decimal [&_ol]:marker:font-black [&_li]:text-[12px] [&_li]:leading-[1.8] [&_li]:text-neutral-900 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_hr]:my-8 [&_hr]:border-neutral-300">
                <Markdown>{sanitize(data.finalOutput || '')}</Markdown>
              </div>
          </div>

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

  const renderFinalPlan = () => {
    const data = isTurnGroup ? (selectedNode?.data as TurnGroupNodeData) : null;
    if (!data) return null;

    return (
      <div className="flex flex-col bg-white">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="compact-markdown prose prose-neutral max-w-none text-black select-text whitespace-normal [&_h1]:text-[15px] [&_h1]:font-black [&_h1]:pb-2 [&_h1]:border-b-2 [&_h1]:border-black [&_h2]:text-[13px] [&_h2]:font-black [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-['■'] before:[&_h2]:text-black before:[&_h2]:text-[10px] [&_h3]:text-[12px] [&_h3]:font-black [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-neutral-900 [&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:text-neutral-900 [&_p]:font-medium [&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4 [&_ul]:list-disc [&_ul]:marker:text-black [&_ol]:list-decimal [&_ol]:marker:font-black [&_li]:text-[12px] [&_li]:leading-[1.8] [&_li]:text-neutral-900 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_hr]:border-neutral-300">
              <Markdown>{sanitize(data.finalOutput || '').replace(/### 8\.3 Final Strategic Output/g, '')}</Markdown>
              {data.transparencyReport && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <h2 className="text-[13px] font-black mt-2 mb-2 flex items-center gap-2 before:content-['■'] before:text-black before:text-[10px]">
                    Metacognitive Transparency
                  </h2>
                  <ul className="pl-5 list-disc marker:text-black">
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
              navigator.clipboard.writeText((data.finalOutput || '').replace(/### 8\.3 Final Strategic Output/g, '').replace(/### 8\.3 Final Consensus Opinion/g, '').trim() + repText);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] font-black text-black hover:bg-neutral-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" /> Copy Final Opinion
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'absolute top-4 bottom-4 z-40 flex items-start',
        !isResizing && 'transition-all duration-300 ease-in-out'
      )}
      style={{ 
        right: isRightPanelOpen ? 16 : -rightPanelWidth - 20,
        width: isRightPanelOpen ? rightPanelWidth : 284 // 닫혔을 때 핸들 위치 확보용 기본값
      }}
    >
      <button
        onClick={toggleRightPanel}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all border border-transparent z-40",
          isRightPanelOpen 
            ? "mr-4 mt-2 bg-white shadow-md border-neutral-200 text-neutral-600 hover:bg-neutral-50" 
            : "mr-3 mt-1 text-neutral-400 hover:text-black hover:bg-neutral-50"
        )}
        style={{
          position: isRightPanelOpen ? 'relative' : 'absolute',
          right: isRightPanelOpen ? 'auto' : 0
        }}
        title={isRightPanelOpen ? 'Close Panel' : 'Open Panel'}
      >
        {isRightPanelOpen ? <ChevronRight className="h-4 w-4" /> : <Settings className="h-5 w-5" />}
      </button>

      <div 
        className={cn(
          "h-full bg-[#fcfcfc] shadow-[-10px_0_30px_rgba(0,0,0,0.015)] border-l border-neutral-100 flex flex-col overflow-visible font-sans flex-1 transition-opacity relative",
          !isRightPanelOpen && "opacity-0 pointer-events-none"
        )}
      >
        {/* [NEW] Resize Handle - 패널 좌측 경계선에 정확히 밀착 */}
        {isRightPanelOpen && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className={cn(
              "absolute left-[-6px] top-0 bottom-0 w-[12px] cursor-col-resize z-[60] group flex items-center justify-center transition-all",
              isResizing ? "bg-black/10" : "hover:bg-black/[0.04]"
            )}
          >
            <div className={cn(
              "h-10 w-[3px] rounded-full bg-neutral-200 transition-all group-hover:bg-neutral-500",
              isResizing && "bg-black h-16 w-[4px]"
            )} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full relative overflow-hidden">
          
          <div className="p-4 border-b border-neutral-50 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10 transition-colors">
            <div className="flex items-center gap-1.5 px-4 py-1.5 border border-neutral-100 rounded-full cursor-pointer hover:bg-neutral-50 transition-colors shadow-sm bg-white">
              <span className="text-[11px] font-bold tracking-wider text-neutral-900">PLANNERS</span>
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            </div>
            <div className="flex items-center gap-3">
            <button className="p-2 border border-neutral-100 rounded-lg hover:bg-neutral-50 transition-colors">
                <LayoutPanelLeft className="h-4 w-4 text-neutral-400" />
              </button>
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

          <div className="flex-1 flex flex-col min-h-0">
            {selectedNode && isTurnGroup ? (
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {parsedSelection.role
                      ? parsedSelection.role === 'finalPlan' ? 'FINAL OPINION' : roleTitles[parsedSelection.role]
                      : 'DEBATE LOG'}
                  </h3>
                </div>

                {/* [NEW] 취합된 통합 안건 섹션 (요약본 및 키워드 우선 노출) */}
                {!parsedSelection.role && (
                  <div className="mb-8 p-5 bg-neutral-50 rounded-[28px] border border-neutral-100 shadow-inner group transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="h-4 w-4 text-black" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-black">Aggregated Context</span>
                    </div>

                    {/* 키워드 노출 */}
                    {(selectedNode.data as TurnGroupNodeData).aggregatedKeywords && (selectedNode.data as TurnGroupNodeData).aggregatedKeywords!.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(selectedNode.data as TurnGroupNodeData).aggregatedKeywords?.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 bg-neutral-200/50 text-neutral-600 rounded-full text-[9px] font-bold tracking-tight">
                            # {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 요약본 또는 원본 텍스트 노출 */}
                    <div className="text-[12px] leading-relaxed text-neutral-600 font-medium whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar select-text">
                      {sanitize((selectedNode.data as TurnGroupNodeData).aggregatedSummary 
                        ? (selectedNode.data as TurnGroupNodeData).aggregatedSummary 
                        : (selectedNode.data as TurnGroupNodeData).aggregatedPrompt)}
                    </div>
                  </div>
                )}

                <div className="min-h-[500px]">
                  {parsedSelection.role 
                    ? (parsedSelection.role === 'finalPlan' ? renderFinalPlan() : renderSingleExpert()) 
                    : renderFullDebateLog()}
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="p-5 flex flex-col gap-2.5 min-h-0">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400">
                      {selectedNodeIds.length > 1 ? `${selectedNodeIds.length} NODES SELECTED` : 'CODE'}
                    </span>
                    <Copy className="h-3 w-3 text-neutral-300 cursor-pointer hover:text-neutral-500 transition-colors" />
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm relative overflow-hidden group">
                    {selectedNode && isPromptNode(selectedNode) && (
                      <div className="flex items-center gap-2 p-3 bg-neutral-50/50 border-b border-neutral-100 overflow-x-auto no-scrollbar">
                        {(() => {
                          const pData = getPromptNodeData(selectedNode.data);
                          const vers = pData.versions || [];
                          
                          return vers.map((v, idx) => (
                            <button
                              key={v.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                useStore.getState().updateNodeData(selectedNode.id, { currentVersionId: v.id });
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                                v.id === pData.currentVersionId
                                  ? "bg-white border-black text-black shadow-md scale-105"
                                  : "bg-white/50 border-transparent text-neutral-400 hover:bg-white hover:border-neutral-200"
                              )}
                            >
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color || '#F9FAFB' }} />
                              V{idx + 1}
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                    <textarea
                      id={`input-dashboard-${selectedNodeId || 'root'}`}
                      name={`textarea-prompt-${selectedNodeId || 'root'}`}
                      value={selectedNodeIds.length > 1 
                        ? selectedNodeIds.map(id => {
                            const node = nodes.find(n => n.id === id);
                            if (!node) return '';
                            let text = '';
                            if (isTurnGroupNode(node)) {
                              text = (node.data as TurnGroupNodeData).finalOutput;
                            }
                            else if (isPromptNode(node)) {
                              const pData = getPromptNodeData(node.data);
                              const vers = pData.versions || [];
                              const curId = pData.currentVersionId;
                              const currentVer = vers.find(v => v.id === curId) || vers[0];
                              text = currentVer?.text || '';
                            }
                            else if (isStickyNode(node)) {
                              text = (node.data as StickyNodeData).text;
                            }
                            return `[Node: ${node.id}]\n${text}`;
                          }).join('\n\n')
                        : (selectedNode && isPromptNode(selectedNode) 
                            ? (() => {
                                const pData = getPromptNodeData(selectedNode.data);
                                const vers = pData.versions || [];
                                const curId = pData.currentVersionId;
                                const currentVer = vers.find(v => v.id === curId) || vers[0];
                                return currentVer?.text || '';
                              })()
                            : (selectedNode && !isTurnGroup && isStickyNode(selectedNode) ? (selectedNode.data as StickyNodeData).text : dashboardNote)
                          )
                      }
                      readOnly={selectedNodeIds.length > 1}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (selectedNode && isPromptNode(selectedNode)) {
                          const pData = getPromptNodeData(selectedNode.data);
                          const curId = pData.currentVersionId;
                          useStore.getState().updatePromptTextWithBranching(selectedNode.id, curId, val);
                        } else if (selectedNode && !isTurnGroup && isStickyNode(selectedNode)) {
                          if (selectedNodeIds.length > 1) return;
                          useStore.getState().updateNodeData(selectedNode.id, { text: val });
                        } else {
                          if (selectedNodeIds.length > 1) return;
                          setDashboardNote(val);
                        }
                      }}
                      className={cn(
                        "w-full h-48 p-4 bg-transparent text-[11px] font-medium leading-relaxed text-neutral-800 placeholder-neutral-300 resize-none outline-none custom-scrollbar",
                        selectedNodeIds.length > 1 && "bg-neutral-50/50"
                      )}
                      placeholder="Tell me your agenda or topic, and I'll start the best expert team for you right away."
                    />
                  </div>
                </div>

                {/* Experts Section */}
                <div className="p-5 flex flex-col min-h-0 pt-0">
                  <div className="flex items-center justify-between mb-3 px-1 cursor-pointer select-none group/experts" 
                    onClick={() => setIsExpertsOpen(!isExpertsOpen)}>
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={cn("h-3 w-3 text-neutral-300 transition-transform", !isExpertsOpen && "-rotate-90")} />
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400 group-hover/experts:text-black transition-colors">EXPERTS</span>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-bold text-neutral-300 tracking-wider">AUTO-ON</span>
                      <button
                        onClick={() => setAutoExpertMode(!autoExpertMode)}
                        className={cn(
                          'w-7 h-3.5 rounded-full relative transition-colors',
                          autoExpertMode ? 'bg-black' : 'bg-neutral-200'
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all",
                          autoExpertMode ? 'right-0.5' : 'left-0.5 shadow-sm'
                        )} />
                      </button>
                    </div>
                  </div>
                  
                  {isExpertsOpen && (
                    <div className={cn('flex flex-col gap-1.5 pr-1 animate-in fade-in slide-in-from-top-1 duration-200', autoExpertMode ? 'opacity-40 pointer-events-none' : '')}>
                      {EXPERTS.map((expert, idx) => {
                        const isSelected = selectedExpertIds.includes(expert.id);
                        
                        return (
                          <div
                            key={expert.id}
                            onClick={() => toggleExpertSelection(expert.id)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all w-full select-none",
                              isSelected ? "border-neutral-200 bg-white shadow-sm" : "border-neutral-50 bg-white/50 hover:bg-white hover:border-neutral-100"
                            )}
                          >
                            <div className={cn(
                              "w-7 h-7 flex items-center justify-center rounded-full shrink-0 border border-neutral-100 bg-transparent"
                            )}>
                              <div className="w-3.5 h-3.5 rounded-full border border-neutral-200" />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight text-neutral-900 flex-1 truncate">
                              AGENT {idx + 1} <span className="mx-0.5 opacity-20 font-normal">|</span> <span className="font-medium">[{expert.name}]</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* GENERATE Footer (Shared between Dashboard & Sticky) */}
                <div className="p-5 pt-0 bg-[#fcfcfc]">
                  <button
                    id="btn-generate-main"
                    name="btn-generate-main"
                    onClick={async () => {
                      if (isGenerating) return;

                      // 사용자의 요구사항에 따라 모든 생성을 VCS 엔진(TurnGroupNode)으로 일원화합니다.
                      if (selectedNodeIds.length > 1) {
                        // 1. 다중 선택 결합 생성
                        await useStore.getState().combineAndGenerateVCS(selectedNodeIds, dashboardNote);
                        setDashboardNote('');
                      } else if (selectedNode && isStickyNode(selectedNode)) {
                        // 2. 단일 스티키 노드로부터 생성 (VCS 통합)
                        await useStore.getState().combineAndGenerateVCS([selectedNode.id], dashboardNote);
                        setDashboardNote('');
                      } else if (selectedNode && isPromptNode(selectedNode)) {
                        // 3. 프롬프트 노드로부터 생성
                        await useStore.getState().combineAndGenerateVCS([selectedNode.id], dashboardNote);
                        setDashboardNote('');
                      } else {
                        // 4. 소스 없는 신규 생성
                        await handleDashboardGenerate();
                      }
                    }}
                    disabled={
                      isGenerating || 
                      (selectedNodeIds.length <= 1 && !(dashboardNote || "").trim() && !(selectedNode && isStickyNode(selectedNode) && (selectedNode.data.text || "").trim())) ||
                      (selectedNodeIds.length > 1 && selectedNodeIds.every(id => {
                        const n = nodes.find(node => node.id === id);
                        if (!n) return true;
                        if (isStickyNode(n)) return !(n.data.text || "").trim();
                        if (isTurnGroupNode(n)) return !(n.data.finalOutput || "").trim();
                        return true;
                      }))
                    }
                    className="w-full flex items-center justify-center py-4 bg-black text-white rounded-full font-black text-[13px] uppercase tracking-[0.25em] hover:bg-neutral-800 hover:shadow-xl transition-all disabled:bg-neutral-200 disabled:shadow-none active:scale-[0.98]"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : (selectedNodeIds.length > 1 ? "COMBINE & GENERATE" : "GENERATE")}
                  </button>
                  <div className="mt-4 text-center">
                    <span className="text-[8px] font-medium text-neutral-300 tracking-wider">
                      © CRETE CO., LTD. 2025. ALL RIGHTS RESERVED.
                    </span>
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
