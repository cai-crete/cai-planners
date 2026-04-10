import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useStore, INITIAL_GRAY, LEGACY_RED, generateId } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { cn, sanitize, sanitizeShort, formatExpertText } from '../lib/utils';
import {
  X, Copy, ChevronRight, Settings,
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, LayoutPanelLeft, User, RotateCcw, RefreshCw, Send,
  Archive, PanelRightClose, PanelRightOpen, Plus as PlusIcon, FileText, Image as ImageIcon, Library, Download,
  Mic, Paperclip, Sparkles as WandSparkles
} from 'lucide-react';
import Markdown from 'react-markdown';
import {
  AppNode, TurnGroupNodeData, ExpertTurnData, isTurnGroupNode,
  isPromptNode, PromptNodeData, StickyNodeData, isStickyNode, getPromptNodeData,
} from '../types/nodes';
import { EXPERTS } from '../lib/experts';
import { enhancePromptForRegenerate } from '../lib/gemini';
// AttachmentModal 제거 (통합 UI로 대체)

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

/** 사용자 제공 이미지 파일 기반 AI 브랜드 로고 컴포넌트 */
const GeminiIcon = ({ className }: { className?: string }) => (
  <div className={cn("overflow-hidden rounded-full flex items-center justify-center", className)}>
    <img 
      src="/Gemini-Logo.jpg" 
      alt="Gemini" 
      className="w-full h-full object-cover scale-[1.7]"
    />
  </div>
);

const ChatGPTIcon = ({ className }: { className?: string }) => (
  <img
    src="/Gpt logo.jpg"
    alt="GPT"
    className={cn("w-full h-full rounded-full object-cover border border-black/5", className)}
  />
);

const ClaudeIcon = ({ className }: { className?: string }) => (
  <img
    src="/Claude.png"
    alt="Claude"
    className={cn("w-full h-full rounded-full object-cover border border-black/5", className)}
  />
);

const GROUP_BRAND_MAP: Record<string, { name: string; icon: any; color: string }> = {
  A: { name: 'Gemini 3.1 Pro', icon: GeminiIcon, color: 'text-slate-500' },
  B: { name: 'GPT-4o (Latest)', icon: ChatGPTIcon, color: 'text-slate-500' },
  C: { name: 'Claude 3.5 Sonnet', icon: ClaudeIcon, color: 'text-slate-500' },
};

const MARKDOWN_CLASSES = "compact-markdown max-w-none text-black select-text whitespace-normal [&_strong]:font-black [&_strong]:text-black [&_strong]:bg-neutral-100 [&_strong]:px-1 [&_strong]:rounded [&_strong]:ring-1 [&_strong]:ring-neutral-200 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-6 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_hr]:border-neutral-200 text-[13px] leading-[1.8] tracking-tight";

const MarkdownComponents = {
  h1: (p: any) => <h1 className="text-[22px] font-black text-black border-b-4 border-black pb-4 mb-10 mt-6 tracking-tighter" {...p} />,
  h2: (p: any) => <h2 className="text-[19px] font-black text-white bg-black px-4 py-1.5 inline-block mb-6 mt-12 tracking-tight" {...p} />,
  h3: (p: any) => <h3 className="text-[17px] font-black text-black border-l-4 border-black pl-3 mb-10 mt-8" {...p} />,
  h4: (p: any) => {
    const text = String(p.children || '');
    let Icon = Sparkles;
    if (text.includes('Strategy') || text.includes('전략')) Icon = Target;
    if (text.includes('Tactical') || text.includes('전술') || text.includes('Action') || text.includes('실행')) Icon = Zap;
    if (text.includes('Risk') || text.includes('리스크')) Icon = Shield;

    return (
      <div className="flex items-center gap-2 mb-8 mt-8 pb-2 border-b border-neutral-100">
        <Icon className="w-5 h-5 text-black" />
        <h4 className="text-[16px] font-black text-black m-0 tracking-wide" {...p} />
      </div>
    );
  },
  p: (p: any) => <p className="text-[13.5px] leading-[1.8] text-neutral-800 font-medium mb-6" {...p} />,
  strong: (p: any) => <strong className="font-black text-black bg-neutral-100 px-1 rounded ring-1 ring-neutral-200" {...p} />,
  ul: (p: any) => <ul className="space-y-4 mt-4 mb-2 ml-4 list-none" {...p} />,
  li: (p: any) => (
    <li className="relative pl-5 text-[13.5px] leading-[1.7] text-neutral-700 mb-2">
      <div className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-black/30" />
      {p.children}
    </li>
  ),
  blockquote: (p: any) => (
    <div className="my-10 p-6 bg-neutral-50 border-y-2 border-neutral-100 relative italic text-center">
      <span className="absolute top-2 left-4 text-4xl text-neutral-200 font-serif">“</span>
      <div className="text-[15px] font-semibold text-neutral-700 leading-relaxed">{p.children}</div>
      <span className="absolute bottom-2 right-4 text-4xl text-neutral-200 font-serif">”</span>
    </div>
  ),
  hr: () => <div className="h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-14" />
};

const reorderLegacyFinalOutput = (text: string) => {
  if (!text) return '';
  if (/^\s*(###\s*)?(Final Output)/i.test(text)) return text;

  const metaDef = text.match(/###\s*Metacognitive Definition[\s\S]*?(?=###|$)/i);
  const workflow = text.match(/###\s*Workflow Simulation Log[\s\S]*?(?=###|$)/i);
  const finalOut = text.match(/###\s*Final Output[\s\S]*?(?=###\s*Metacognitive Transparency Report|###\s*Metacognitive Definition|$)/i);
  const transparency = text.match(/###\s*Metacognitive Transparency Report[\s\S]*?(?=###|$)/i);

  if (!finalOut) return text;

  return [
    finalOut[0],
    metaDef ? metaDef[0] : '',
    workflow ? workflow[0] : '',
    transparency ? transparency[0] : ''
  ].filter(Boolean).join('\n\n');
};

// 텍스트 내에서 키워드들을 찾아 볼드체로 변경하는 유틸리티
const HighlightText = ({ text, keywords }: { text: string; keywords: string[] }) => {
  if (!keywords || keywords.length === 0) return <>{text}</>;

  // 긴 키워드부터 매칭되도록 정렬 (부분 일치가 아닌 전체 일치 우선 파악)
  const sortedKeywords = Array.from(new Set(keywords))
    .filter(k => k && k.trim().length > 1)
    .sort((a, b) => b.length - a.length);

  const pattern = sortedKeywords
    .map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (!pattern) return <>{text}</>;

  // [CRITICAL FIX] RegExp.test()의 lastIndex 상태 전이 문제를 방지하기 위해 
  // 매번 새로운 정규식 객체를 생성하거나 split 결과만 신뢰합니다.
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        // [SURGICAL FIX] 엄격한 전체 일치(^$)를 제거하여 조사가 붙은 경우에도 키워드 부분만 정확히 식별
        const isMatch = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <strong key={i} className="font-black text-black bg-neutral-100 px-1 rounded ring-1 ring-neutral-200">
            {part}
          </strong>
        ) : part;
      })}
    </>
  );
};

// 최종 기획서에서 첫 1~2문장을 요약으로 추출
const extractSummary = (text: string): string => {
  const plain = text
    .replace(/^#{1,4}\s.+$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*>]\s/gm, '')
    .replace(/\n{2,}/g, ' ')
    .trim();
  const sentences = plain.match(/[^.!?。\n]{10,}[.!?。]+/g) || [];
  const result = sentences.slice(0, 2).join(' ').trim();
  return result || plain.substring(0, 160) + '...';
};

// 역할별 뺄 스타일 (bg, border, dot, 좌/우 정렬)
const ROLE_STYLES = {
  thesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-black', label: '제안', align: 'left' },
  antithesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-400', label: '반박', align: 'right' },
  synthesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-800', label: '통합', align: 'left' },
  support: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-600', label: '검증', align: 'right' },
} as const;

const ExpertBubble = memo(({ expertData, bubbleId, isRight, globalKeywords }: { expertData: ExpertTurnData; bubbleId: string; isRight: boolean; globalKeywords?: string[] }) => {
  const activeExpertRole = useStore(state => state.activeExpertRole);
  const setActiveExpertRole = useStore(state => state.setActiveExpertRole);
  const [isExpanded, setIsExpanded] = useState(true);

  const isAutoFocused = activeExpertRole === expertData.role;
  const shouldExpand = isExpanded || isAutoFocused;

  const E = EXPERTS.find((e) => e.id === expertData.expertId);

  const role = expertData.role as keyof typeof ROLE_STYLES;
  const style = ROLE_STYLES[role] || ROLE_STYLES.thesis;

  // 전문가 전용 키워드와 글로벌 키워드 통합
  const expertKeywords = expertData.keywords || [];
  const mergedKeywords = Array.from(new Set([...expertKeywords, ...(globalKeywords || [])]));

  if (!E) {
    return (
      <div className={cn("flex flex-col w-full mb-3", isRight ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <X className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-[12px] font-bold text-red-500">기획자 할당 오류</span>
        </div>
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600">
          시스템 데이터 바인딩에 실패했습니다. (ID: {expertData.expertId || 'NULL'})
        </div>
      </div>
    );
  }

  const cleanShort = sanitize(expertData.shortContent);
  const cleanFull = sanitize(expertData.fullContent || expertData.shortContent);

  const handleToggle = () => {
    if (shouldExpand) { setIsExpanded(false); setActiveExpertRole(null); }
    else { setIsExpanded(true); }
  };

  return (
    <div
      id={bubbleId}
      className={cn(
        "flex flex-col w-full mb-3",
        isRight ? "items-end" : "items-start"
      )}
    >
      <div className={cn("flex items-center gap-2 mb-1 px-1", isRight && "flex-row-reverse")}>
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm", style.dot)}>
          {(() => {
            const Icon = IconMap[E.iconName] || Bot;
            return <Icon className="w-3 text-white" />;
          })()}
        </div>
        <span className="text-[12px] font-bold text-black tracking-tight">{E.name}</span>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{style.label}</span>

        {cleanFull && (
          <button
            onClick={handleToggle}
            className="ml-1 p-1 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-700"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", shouldExpand && "rotate-180")} />
          </button>
        )}
      </div>

      {/* 말풍선 버블 */}
      <div className={cn(
        "max-w-[92%] border rounded-2xl px-4 py-2.5",
        style.bg, style.border,
        "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        isRight ? "rounded-tr-sm" : "rounded-tl-sm"
      )}>
        <p className="text-[13px] leading-[1.6] text-neutral-800 font-medium">
          {cleanShort ? (
            <>“<HighlightText text={cleanShort} keywords={mergedKeywords} />”</>
          ) : (
            cleanFull ? <HighlightText text={cleanFull.split('\n')[0]} keywords={mergedKeywords} /> : '생성 중...'
          )}
        </p>
        {shouldExpand && cleanFull && (
          <div className="mt-2 pt-2 border-t border-neutral-100 text-[12.5px] leading-[1.7] text-neutral-600 whitespace-pre-wrap font-normal">
            <HighlightText text={cleanFull} keywords={mergedKeywords} />
          </div>
        )}
      </div>
    </div>
  );
});


// 기획자 조합에서 시너지 한 문장 생성
const extractSynergy = (expertIds: string[]): string => {
  const groups = expertIds.map(id => EXPERTS.find(e => e.id === id)?.group || 'Theorists');
  const hasTheorist = groups.includes('Theorists');
  const hasPractitioner = groups.includes('Practitioners');
  const count = expertIds.length;

  const names = expertIds.map(id => {
    const e = EXPERTS.find(ex => ex.id === id);
    // 짧은 키워드 태그 기반 성격 추출
    const kw = e?.keywords?.[0]?.replace('#', '') || '';
    return kw;
  }).filter(Boolean);

  if (hasTheorist && hasPractitioner) {
    return `이론적 통찰과 실행력이 결합된 ${names[0] || '균형'}형 전략팀`;
  } else if (hasTheorist) {
    return `심층 분석과 ${names[0] || '비판적 사고'} 중심의 이론 탐구팀`;
  } else {
    return `실무 검증과 ${names[0] || '혁신 실행'} 중심의 현장형 기획팀`;
  }
};

const AIBubble = memo(({ node }: { node: AppNode }) => {
  const data = node.data as TurnGroupNodeData;
  const [isDebateOpen, setIsDebateOpen] = useState(false);
  const [isOtherGroupsOpen, setIsOtherGroupsOpen] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  // 1. 병렬 생성 모드이면서 결과 그룹이 선택되지 않은 경우 (A, B, C 카드 비교 화면)
  if (data.isParallel && !data.selectedGroupId) {
    return (
      <div className="flex flex-col items-start w-full mb-8 relative group">
        <div className="flex w-full mb-4 items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-[12px] font-black uppercase tracking-widest text-black flex items-center gap-2">
            PLANNERS
            {data.metacognitiveDefinition?.selectedMode && (
              <span className="text-[#00c853] text-[9px] font-bold">
                Mode {data.metacognitiveDefinition.selectedMode} — {
                  data.metacognitiveDefinition.selectedMode === 'A' ? '혁신 탐구' :
                    data.metacognitiveDefinition.selectedMode === 'B' ? '논리 심화' : '실용 해법'
                }
              </span>
            )}
            {!data.metacognitiveDefinition?.selectedMode && data.parallelResults?.[0]?.mode && (
              <span className="text-[#00c853] text-[9px] font-bold">
                Mode {data.parallelResults[0].mode} — {
                  data.parallelResults[0].mode === 'A' ? '혁신 탐구' :
                    data.parallelResults[0].mode === 'B' ? '논리 심화' : '실용 해법'
                }
              </span>
            )}
          </span>
          <button
            onClick={() => setIsAllExpanded(!isAllExpanded)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-black hover:text-white rounded-full transition-all text-[10px] font-black uppercase tracking-wider shadow-sm"
          >
            {isAllExpanded ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />}
            {isAllExpanded ? '전문 접기' : '전체 전문 보기'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full">
          {data.parallelResults?.map((pResult, i) => {
            const groupLabel = ['A', 'B', 'C'][i] || String(i + 1);
            const brand = GROUP_BRAND_MAP[pResult.groupId] || { name: `Group ${pResult.groupId}`, icon: Sparkles, color: 'text-neutral-400' };
            const BrandIcon = brand.icon;
            const summaryText = pResult.data?.finalOutput ? extractSummary(sanitize(pResult.data.finalOutput)) : null;
            const synergyText = extractSynergy(pResult.squadIds);
            return (
              <div key={pResult.groupId} className="flex flex-col border border-neutral-200 rounded-2xl bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* 그룹 헤더 (AI Branding 적용) */}
                <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={cn("w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center shrink-0 shadow-sm", brand.color)}>
                         <BrandIcon className="w-7 h-7" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-black/70">{brand.name}</span>
                    </div>
                  <p className="text-[10px] text-neutral-500 font-medium mb-2 leading-snug">{synergyText}</p>
                  <div className="flex flex-wrap gap-1">
                    {pResult.squadIds.map(id => {
                      const e = EXPERTS.find(exp => exp.id === id);
                      return <div key={id} className="text-[9px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-md px-1.5 py-0.5 whitespace-nowrap">{e?.name || id}</div>;
                    })}
                  </div>
                </div>

                {/* 요약 + 전문 토글 (isAllExpanded에 연동) */}
                <div className="flex-1 p-4">
                  {pResult.status === 'loading' && !summaryText ? (
                    <div className="flex flex-col gap-2 animate-pulse">
                      <div className="h-2.5 bg-neutral-200 rounded w-full" />
                      <div className="h-2.5 bg-neutral-200 rounded w-3/4" />
                      <div className="h-2.5 bg-neutral-200 rounded w-1/2" />
                      <div className="flex items-center gap-2 mt-3 text-neutral-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px] font-bold">생성 중...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="bg-neutral-50 border-l-[3px] border-black rounded-r-xl px-4 py-3">
                        <p className="text-[12px] italic leading-relaxed text-neutral-700 font-medium">
                          &ldquo;{summaryText || '생성 중...'}&rdquo;
                        </p>
                        {pResult.status === 'loading' && (
                          <span className="inline-block w-1 h-3 bg-black ml-1 animate-pulse mt-1" />
                        )}
                      </div>
                      {isAllExpanded && pResult.data?.finalOutput && (
                        <div className={cn(MARKDOWN_CLASSES, "mt-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pt-4 border-t border-neutral-100")}>
                          <Markdown components={MarkdownComponents}>
                            {sanitize(pResult.data?.finalOutput || '').replace(/###\s*Final Strategic Output/g, '')}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 하단 선택 버튼 */}
                <div className="p-3 bg-neutral-50 border-t border-neutral-100">
                  <button
                    disabled={pResult.status === 'loading'}
                    onClick={() => {
                      useStore.getState().updateNodeData(node.id, {
                        selectedGroupId: pResult.groupId,
                        thesis: pResult.data?.thesis,
                        antithesis: pResult.data?.antithesis,
                        synthesis: pResult.data?.synthesis,
                        support: pResult.data?.support,
                        keywords: pResult.data?.aggregatedKeywords,
                        finalOutput: pResult.data?.finalOutput,
                        workflowSimulationLog: pResult.data?.workflowSimulationLog,
                        transparencyReport: pResult.data?.transparencyReport
                      });
                    }}
                    className="w-full py-2 bg-black text-white text-[11px] font-bold tracking-widest uppercase rounded-xl hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors shadow-sm"
                  >
                    이 답변 선택 →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. 단일 답변 또는 병렬 생성 후 답변 선택이 확정된 경우 (상세 기획서 뷰)
  const cleanedFinalOutput = reorderLegacyFinalOutput(sanitize(data.finalOutput || ''))
    .replace(/###\s*8\.\d\s*\[?([^\]\n]+)\]?/g, '### $1')
    .replace(/8\.\d\s*\[?([^\]\n]+)\]?/g, '$1');

  if (!cleanedFinalOutput) return null;

  const summary = extractSummary(cleanedFinalOutput);
  const roles = [data.thesis, data.antithesis, data.support, data.synthesis].filter(
    (e): e is ExpertTurnData => !!e?.expertId
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedFinalOutput);
      alert("클립보드에 복사되었습니다.");
    } catch (e) {
      console.error("복사에 실패했습니다.", e);
    }
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const formattedLog = formatExpertText(data.workflowSimulationLog);
    const downloadContent = `[통합 전략 기획서]\n\n${cleanedFinalOutput}\n\n` +
      `================================================\n` +
      `[WORKFLOW SIMULATION LOG - 분석 과정 기록]\n` +
      `================================================\n\n` +
      `${formattedLog}`;

    const file = new Blob([downloadContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    element.download = `기획안_${data.selectedGroupId || '최종'}_${dateStr}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleRegenerate = () => {
    const ev = useStore.getState().edges.find(e => e.target === node.id);
    if (ev) useStore.getState().reGenerateFromPrompt(ev.source);
  };

  return (
    <div className="flex flex-col items-start w-full mb-8 relative group">
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-[12px] font-black uppercase tracking-widest text-black flex items-center gap-2">
            PLANNERS
            {data.selectedGroupId && (() => {
              const brand = GROUP_BRAND_MAP[data.selectedGroupId] || { name: `Group ${data.selectedGroupId}`, icon: Sparkles, color: 'text-neutral-400' };
              const BrandIcon = brand.icon;
              return (
                <span className="bg-black/5 px-2 py-1 rounded-full text-[10px] text-neutral-600 border border-black/10 flex items-center gap-2">
                  <BrandIcon className={cn("w-6 h-6", brand.color)} />
                  {brand.name}
                  {data.parallelResults?.find(p => p.groupId === data.selectedGroupId)?.synergyScore && (
                    <span className="ml-1 pl-2 border-l border-black/10 font-black text-black/40">SC {data.parallelResults.find(p => p.groupId === data.selectedGroupId)?.synergyScore}</span>
                  )}
                </span>
              );
            })()}
            {data.metacognitiveDefinition?.selectedMode && (
              <span className="text-[#00c853] text-[9px]">
                Mode {data.metacognitiveDefinition.selectedMode} — {
                  data.metacognitiveDefinition.selectedMode === 'A' ? '혁신 탐구' :
                    data.metacognitiveDefinition.selectedMode === 'B' ? '논리 심화' : '실용 해법'
                }
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="max-w-[88%] rounded-[20px] border border-neutral-200/80 bg-white shadow-[0_4px_24px_rgb(0,0,0,0.07)] overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          {data.loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-neutral-100 rounded w-3/4" />
              <div className="h-3 bg-neutral-100 rounded w-1/2" />
            </div>
          ) : (
            <p className="text-[13px] italic leading-relaxed text-neutral-600 font-medium border-l-[3px] border-black pl-4">&ldquo;{summary}&rdquo;</p>
          )}
        </div>

        {roles.length > 0 && (
          <div className="px-6 py-5 border-b border-neutral-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">기획자 대화</div>
            <div className="space-y-2">
              {roles.map((expertData, i) => (
                <ExpertBubble
                  key={i}
                  expertData={expertData}
                  bubbleId={`expert-bubble-${node.id}-${expertData.role}`}
                  isRight={i % 2 === 1}
                  globalKeywords={data.keywords}
                />
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">통합 전략 기획서</span>
          </div>
          {data.loading ? (
            <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span className="text-[12px] font-bold text-neutral-500">분석 및 전략 수립 중...</span>
            </div>
          ) : (
            <div className={cn(MARKDOWN_CLASSES, "relative pl-6 border-l-2 border-black/10")}>
              {/* 수직 전략 흐름선 포인트 */}
              <div className="absolute left-[-5px] top-0 bottom-0 w-[8px] pointer-events-none flex flex-col items-center py-8">
                <div className="w-2.5 h-2.5 rounded-full bg-black ring-4 ring-white" />
                <div className="flex-1 w-[2px] bg-gradient-to-b from-black via-black/20 to-transparent" />
              </div>
              <Markdown components={MarkdownComponents}>
                {cleanedFinalOutput.replace(/###\s*Final Strategic Output/g, '')}
              </Markdown>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100">
          {data.isParallel && data.parallelResults && data.selectedGroupId && (
            <div className="border-b border-neutral-100">
              <button onClick={() => setIsOtherGroupsOpen(!isOtherGroupsOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors">
                <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Archive className="w-4 h-4" /> 다른 그룹 답변 보기</span>
                <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", isOtherGroupsOpen && "rotate-180")} />
              </button>
              {isOtherGroupsOpen && (
                <div className="px-6 pb-5 pt-4 grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {data.parallelResults.filter(p => p.groupId !== data.selectedGroupId).map(pResult => {
                    const brand = GROUP_BRAND_MAP[pResult.groupId] || { name: `Group ${pResult.groupId}`, icon: Sparkles, color: 'text-neutral-400' };
                    const BrandIcon = brand.icon;
                    return (
                      <div key={pResult.groupId} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col transition-all hover:border-black/20">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <BrandIcon className={cn("w-6 h-6", brand.color)} />
                            <div className="text-[10px] font-black uppercase text-neutral-500">{brand.name}</div>
                          </div>
                          {pResult.synergyScore && (
                            <div className="text-[9px] font-black text-black/40">SC {pResult.synergyScore}</div>
                          )}
                        </div>
                        <div className={cn(MARKDOWN_CLASSES, "text-[11px]")}><Markdown>{sanitize(pResult.data?.finalOutput || '데이터 없음')}</Markdown></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 하단 액션 버튼 그룹 */}
          <div className="grid grid-cols-3 divide-x divide-neutral-100 bg-neutral-50/30">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-black hover:bg-white transition-all uppercase"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              onClick={handleRegenerate}
              className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-black hover:bg-white transition-all uppercase"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-generate
            </button>
            <button
              onClick={handleDownloadTxt}
              className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-black hover:bg-white transition-all uppercase"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});




const UserBubble = memo(({ node, onRewind }: { node: AppNode, onRewind: (text: string) => void }) => {
  let text = '';
  if (isPromptNode(node)) {
    const pData = getPromptNodeData(node.data);
    const curVer = pData.versions.find(v => v.id === pData.currentVersionId) || pData.versions[0];
    text = curVer?.text || '';
  } else if (isStickyNode(node)) {
    text = (node.data as StickyNodeData).text;
  }
  const setSelectedNodeId = useStore(state => state.setSelectedNodeId);

  return (
    <div className="flex flex-col items-end w-full mb-8 relative group">
      <div className="flex items-center gap-2 mb-2 w-full justify-end px-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            setSelectedNodeId(node.id);
            onRewind(text);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg shadow-sm text-[10px] font-bold tracking-wider text-neutral-400 hover:text-black transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> 되돌리기
        </button>
      </div>
      <div className="max-w-[85%] bg-neutral-100/70 rounded-3xl rounded-tr-sm px-5 py-4 text-[13.5px] font-medium leading-[1.8] text-neutral-900 border border-neutral-200 shadow-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
});

export const RightPanel = memo(() => {
  const isRightPanelOpen = useStore(state => state.isRightPanelOpen);
  const toggleRightPanel = useStore(state => state.toggleRightPanel);
  const selectedNodeId = useStore(state => state.selectedNodeId);
  const isGenerating = useStore(state => state.isGenerating);
  const rightPanelWidth = useStore(state => state.rightPanelWidth);
  const setRightPanelWidth = useStore(state => state.setRightPanelWidth);
  const nodes = useStore(state => state.nodes);
  const getChatHistory = useStore(state => state.getChatHistory);
  const isCanvasOpen = useStore(state => state.isCanvasOpen);
  const isLeftPanelOpen = useStore(state => state.isLeftPanelOpen);

  const [chatInput, setChatInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [chatImage, setChatImage] = useState<string | undefined>(undefined);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanceDialog, setShowEnhanceDialog] = useState(false);
  const [enhancedOptions, setEnhancedOptions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastActiveNodeId = useStore(state => state.lastActiveNodeId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { resizeImageLocal } = await import('../lib/utils');
      const optimizedDataUrl = await resizeImageLocal(file, 1024);
      setChatImage(optimizedDataUrl);
    } catch (error) {
      console.error("Image processing failed", error);
    }
  };

  const liveChatHistory = useMemo(() => {
    const rawId = selectedNodeId || lastActiveNodeId;
    if (!rawId) return [];
    // ::role 형식이 실수로 들어올 경우를 대비하여 실제 노드 ID를 파싱
    const targetId = rawId.includes('::') ? rawId.split('::')[0] : rawId;
    return getChatHistory(targetId);
  }, [selectedNodeId, lastActiveNodeId, getChatHistory, nodes, isGenerating]);

  // Auto scroll to bottom smoothly
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [liveChatHistory.length, isGenerating]);

  // #2 기획자 아이콘 클릭 시 해당 ExpertBubble로 스크롤 이동
  const activeExpertRole = useStore(state => state.activeExpertRole);
  useEffect(() => {
    if (!activeExpertRole) return;
    // 마지막 TurnGroupNode를 찾아 bubbleId를 여싸었다
    const lastGroupNode = [...liveChatHistory].reverse().find(n => n.type === 'turnGroup');
    if (!lastGroupNode) return;
    const bubbleId = `expert-bubble-${lastGroupNode.id}-${activeExpertRole}`;
    // 짧은 지연 후 스크롤 (렌더링 대기)
    setTimeout(() => {
      const el = document.getElementById(bubbleId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [activeExpertRole]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const buttonOffset = 52;
      const newWidth = (window.innerWidth - e.clientX - 16) + buttonOffset;
      const maxWidth = window.innerWidth * 0.8;
      const minWidth = 400;

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

  const handleEnhancePrompt = async () => {
    if (!chatInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const versions = [
        `[전략] ${chatInput}의 가치 제안(Value Proposition)을 강화하고, 타겟 세그먼트별 맞춤형 실행 단계와 KPI를 포함한 종합 전략안을 도출해줘.`,
        `[논리] ${chatInput}과 관련하여 현재 시장의 경쟁 구도와 잠재적 리스크를 분석하고, 이를 극복하기 위한 인과관계가 명확한 논리 구조를 설계해줘.`,
        `[창의] ${chatInput}을 기존의 방식과 다른 혁신적 이미지로 재해석하여, 대중의 감성을 자극할 수 있는 독창적인 스토리텔링 기획안을 제안해줘.`
      ];
      setEnhancedOptions(versions);
      setShowEnhanceDialog(true);
    } catch (err) {
      console.error('[Enhance Error]', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isGenerating) return;

    if (liveChatHistory.length === 0) {
      const promptNodeId = `node-prompt-${generateId()}`;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2 - 100;

      useStore.getState().setNodes(useStore.getState().nodes.map(n => ({ ...n, selected: false })));
      useStore.getState().addNode({
        id: promptNodeId,
        type: 'sticky',
        position: { x: cx - 400, y: cy },
        data: {
          text: '',
          versions: [{ id: 'v1', text: chatInput, color: INITIAL_GRAY, timestamp: Date.now() }],
          currentVersionId: 'v1'
        },
        selected: true,
      } as any);

      useStore.getState().setSelectedNodeId(promptNodeId);
      setChatInput('');
      setChatImage(undefined);
      setTimeout(() => {
        useStore.getState().reGenerateFromPrompt(promptNodeId);
      }, 100);

    } else {
      const leafNode = liveChatHistory[liveChatHistory.length - 1];
      if (isTurnGroupNode(leafNode)) {
        useStore.getState().createPromptAndRegenerate(leafNode.id, chatInput, chatImage);
        setChatInput('');
        setChatImage(undefined);
      } else if (isPromptNode(leafNode) || isStickyNode(leafNode)) {
        // 되돌리기 후 재작성 대응 (Rewind State)
        // 1. 현재 타임라인 스냅샷 저장
        await useStore.getState().duplicateCurrentProject();

        // 2. 현재 노드 수정 및 재생성
        const pData = getPromptNodeData(leafNode.data);
        const newVerId = `v-rewind-${Date.now()}`;
        await useStore.getState().updateNodeData(leafNode.id, {
          text: '',
          versions: [
            ...(pData.versions || []),
            {
              id: newVerId,
              text: chatInput,
              color: INITIAL_GRAY,
              timestamp: Date.now(),
              imageData: chatImage
            }
          ].slice(-6),
          currentVersionId: newVerId
        } as any);

        setChatInput('');
        setChatImage(undefined);

        // 3. 해당 프롬프트 기반으로 재생성 시작
        setTimeout(() => {
          useStore.getState().reGenerateFromPrompt(leafNode.id);
        }, 100);
      }
    }
  };

  return (
    <div
      className={cn(
        'relative flex-1 flex flex-col h-full py-4 transition-all duration-300 ease-out z-40',
        isCanvasOpen ? 'mr-[33.333333%] pr-4' : 'mr-0 pr-0',
        isLeftPanelOpen ? 'pl-[320px]' : 'pl-[100px]'
      )}
    >
      <div
        className={cn(
          "flex h-full w-full flex-col bg-white shadow-[0_8px_32px_rgb(0,0,0,0.06)] border border-neutral-200/60 overflow-hidden backdrop-blur-xl relative transition-all duration-300",
          isCanvasOpen ? "rounded-[32px]" : "rounded-l-[32px] border-r-0"
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white/90 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => useStore.getState().toggleLeftPanel()}
              className="p-1.5 mr-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
              title="라이브러리 토글"
            >
              <Library className="w-[18px] h-[18px]" />
            </button>
            <Bot className="h-5 w-5 text-black" />
            <button
              onClick={() => useStore.getState().createNewProject()}
              title="새로 생각하기 (초기화)"
              className="text-[14px] font-black uppercase tracking-[0.1em] text-black transition-opacity hover:opacity-70 text-left"
            >
              {(() => {
                const firstPrompt = nodes.find(n => isPromptNode(n));
                if (firstPrompt) {
                  const pData = getPromptNodeData(firstPrompt.data as any);
                  const text = pData.versions?.find((v: any) => v.text?.trim())?.text?.trim()
                    || (pData as any).text?.trim?.();
                  if (text) return text.length > 30 ? text.substring(0, 30) + '...' : text;
                }
                return 'PLANNERS';
              })()}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => useStore.getState().toggleCanvas()}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg text-[11px] font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
              title="무한 캔버스 열기/닫기"
            >
              {useStore.getState().isCanvasOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />} CANVAS
            </button>
          </div>
        </div>

        {/* Chat History View */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-60 bg-neutral-50/60">
          {liveChatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-4 opacity-50 select-none">
              <Bot className="h-12 w-12 text-neutral-200" />
              <span className="text-[12px] font-bold tracking-widest text-neutral-400">하단 입력창을 통해 대화를 시작하세요.</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {liveChatHistory.map((node, i) => {
                if (isTurnGroupNode(node)) {
                  return <AIBubble key={`${node.id}-${i}`} node={node} />;
                } else if (isPromptNode(node) || isStickyNode(node)) {
                  return <UserBubble key={`${node.id}-${i}`} node={node} onRewind={(t) => setChatInput(t)} />;
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Floating Input Bar (Gemini AI Studio Pro Style) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 rounded-b-2xl pointer-events-none">
          {/* Prompt Enhancement Selection Overlay (Floating) - Moved outside overflow-hidden */}
          {showEnhanceDialog && enhancedOptions.length > 0 && (
            <div className="absolute bottom-[calc(100%-20px)] left-10 right-10 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
              <div className="bg-white/80 backdrop-blur-2xl border border-neutral-200 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden mx-2 ring-1 ring-black/5">
                <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-white/40">
                  <div className="flex items-center gap-2">
                    <WandSparkles className="w-4 h-4 text-black" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-black/60">전문 기획자들의 대안 제안</span>
                  </div>
                  <button onClick={() => setShowEnhanceDialog(false)} className="p-1 hover:bg-neutral-100 rounded-full transition-colors">
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
                <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {enhancedOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setChatInput(opt);
                        setShowEnhanceDialog(false);
                      }}
                      className="w-full text-left p-4 rounded-2xl hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all group flex gap-3 items-start"
                    >
                      <span className="bg-black text-white text-[9px] font-black px-1.5 py-0.5 rounded mt-1 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity">0{i + 1}</span>
                      <p className="text-[13px] font-medium leading-relaxed text-neutral-700 group-hover:text-black">{opt}</p>
                    </button>
                  ))}
                </div>
                <div className="px-6 py-3 bg-neutral-50/50 border-t border-neutral-100 text-center">
                  <p className="text-[10px] font-bold text-neutral-400">제안된 안건 중 하나를 클릭하여 즉시 적용하세요.</p>
                </div>
              </div>
            </div>
          )}

          <div className="relative flex flex-col w-full bg-[#f4f4f4] rounded-[32px] border border-neutral-200 shadow-sm transition-all focus-within:bg-white focus-within:border-neutral-300 focus-within:shadow-xl overflow-hidden group/input-container pointer-events-auto">

            {/* Gemini-style Attachment Preview Area (Inline) */}
            {chatImage && (
              <div className="flex flex-wrap gap-2 px-6 pt-5 pb-1 animate-in fade-in slide-in-from-top-2 duration-400">
                <div className="relative group/thumb shadow-2xl rounded-2xl overflow-hidden ring-1 ring-neutral-200">
                  <div className="w-24 h-24 overflow-hidden bg-neutral-100">
                    <img src={chatImage} alt="Attachment" className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-700" />
                  </div>
                  <button
                    onClick={() => setChatImage(undefined)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white backdrop-blur-md opacity-0 group-hover/thumb:opacity-100 transition-all hover:bg-red-500 scale-75 group-hover/thumb:scale-100"
                    title="삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm py-1 px-2">
                    <p className="text-[8px] font-black text-white/90 truncate uppercase tracking-tighter">IMAGE_DATA.webp</p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative flex flex-col pt-1">
              <textarea
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  if (liveChatHistory.length <= 1) {
                    useStore.getState().syncFirstPromptText(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder={isGenerating ? "분석 중입니다..." : "최고의 전문가 팀과 안건을 토론해 보세요."}
                disabled={isGenerating}
                className="w-full max-h-[220px] min-h-[64px] pt-4 pb-14 pl-6 pr-6 bg-transparent text-[14px] font-medium leading-relaxed text-black placeholder-neutral-400 resize-none outline-none custom-scrollbar disabled:opacity-50"
              />

              {/* Gemini-style Bottom Toolbelt */}
              <div className="absolute bottom-2 left-0 right-0 px-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1 pointer-events-auto">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-200/50 transition-all"
                    title="이미지/파일 추가"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={!chatInput.trim() || isEnhancing || isGenerating}
                    className={cn(
                      "p-2.5 rounded-full transition-all",
                      isEnhancing ? "text-black animate-pulse bg-neutral-200" : "text-neutral-400 hover:text-black hover:bg-neutral-200/50"
                    )}
                    title="프롬프트 마법사 (안건 고도화)"
                  >
                    <WandSparkles className={cn("w-4.5 h-4.5", isEnhancing && "text-black")} />
                  </button>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <div className="w-px h-4 bg-neutral-200 mx-1" />

                  <button
                    className="p-2.5 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-200/50 transition-all"
                    title="음성 입력"
                  >
                    <Mic className="w-4.5 h-4.5" />
                  </button>

                  <button
                    onClick={handleChatSubmit}
                    disabled={(!chatInput.trim() && !chatImage) || isGenerating}
                    className={cn(
                      "p-2.5 rounded-full transition-all shadow-sm",
                      (chatInput.trim() || chatImage) && !isGenerating
                        ? "bg-black text-white hover:scale-105 active:scale-95 shadow-lg"
                        : "bg-neutral-200 text-neutral-400"
                    )}
                  >
                    {isGenerating ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <span className="text-[9px] font-black text-neutral-300 tracking-widest uppercase flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
              © {new Date().getFullYear()} CRETE CO., LTD. ALL RIGHTS RESERVED.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
