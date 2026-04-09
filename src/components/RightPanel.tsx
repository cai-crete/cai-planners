import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { useStore, INITIAL_GRAY, LEGACY_RED, generateId } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { cn, sanitize, sanitizeShort } from '../lib/utils';
import {
  X, Copy, ChevronRight, Settings,
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, LayoutPanelLeft, User, RotateCcw, RefreshCw, Send, Image as ImageIcon
} from 'lucide-react';
import Markdown from 'react-markdown';
import {
  AppNode, TurnGroupNodeData, ExpertTurnData, isTurnGroupNode,
  isPromptNode, PromptNodeData, StickyNodeData, isStickyNode, getPromptNodeData,
  isSynapseNode
} from '../types/nodes';
import { EXPERTS } from '../lib/experts';
import { AttachmentModal } from './AttachmentModal';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

const MARKDOWN_CLASSES = "compact-markdown prose prose-neutral max-w-none text-black select-text whitespace-normal [&_h1]:text-[17px] [&_h1]:font-black [&_h1]:pb-3 [&_h1]:border-b-2 [&_h1]:border-black [&_h1]:mb-6 [&_h2]:text-[15px] [&_h2]:font-black [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 before:[&_h2]:content-['■'] before:[&_h2]:text-black before:[&_h2]:text-[11px] [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-[14px] [&_h3]:font-black [&_h3]:pl-4 [&_h3]:border-l-4 [&_h3]:border-black [&_h3]:mt-6 [&_h3]:mb-4 [&_h4]:text-[14px] [&_h4]:font-black [&_h4]:text-black [&_h4]:mt-6 [&_h4]:mb-3 [&_h4]:flex [&_h4]:items-center [&_h4]:gap-1.5 before:[&_h4]:content-['▸'] before:[&_h4]:text-black [&_p]:text-[12.5px] [&_p]:leading-[2.2] [&_p]:text-neutral-800 [&_p]:font-medium [&_p]:mb-4 [&_strong]:font-black [&_strong]:text-black [&_strong]:underline [&_strong]:decoration-neutral-300 [&_strong]:underline-offset-4 [&_ul]:list-disc [&_ul]:marker:text-black [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:marker:font-black [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:text-[12.5px] [&_li]:leading-[2.2] [&_li]:text-neutral-800 [&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_blockquote]:mb-4 [&_hr]:my-8 [&_hr]:border-neutral-200";

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

const ExpertBubble = memo(({ expertData, bubbleId }: { expertData: ExpertTurnData; bubbleId: string }) => {
  const activeExpertRole = useStore(state => state.activeExpertRole);
  const setActiveExpertRole = useStore(state => state.setActiveExpertRole);
  const [isExpanded, setIsExpanded] = useState(false);

  const isAutoFocused = activeExpertRole === expertData.role;
  const shouldExpand = isExpanded || isAutoFocused;

  const E = EXPERTS.find((e) => e.id === expertData.expertId);
  if (!E) return null;
  const Icon = IconMap[E.iconName || 'Bot'] || Bot;

  // #3 sanitize 적용
  const cleanShort = sanitize(expertData.shortContent);
  const cleanFull = sanitize(expertData.fullContent || expertData.shortContent);

  const handleToggle = () => {
    if (shouldExpand) {
      // 닫을 때: 로컰 상태와 activeExpertRole 동시 인식화
      setIsExpanded(false);
      setActiveExpertRole(null);
    } else {
      setIsExpanded(true);
    }
  };

  return (
    <div
      id={bubbleId}
      className={cn(
        "flex flex-col items-start w-full mb-6 relative group",
        isAutoFocused && "ring-2 ring-black/10 rounded-2xl"
      )}
    >
       <div className="flex items-center gap-2 mb-2 px-1">
          <div className={cn(
            "w-8 h-8 rounded-full border flex items-center justify-center shadow-sm transition-all",
            isAutoFocused ? "bg-black border-black" : "bg-white border-neutral-200"
          )}>
             <Icon className={cn("w-4 h-4", isAutoFocused ? "text-white" : "text-neutral-600")} />
          </div>
          <div>
            <div className="text-[12.5px] font-bold text-black flex items-center gap-1.5">
              <span className="text-neutral-500 font-medium">{expertData.role === 'thesis' ? '제안' : expertData.role === 'antithesis' ? '반박' : expertData.role === 'support' ? '검증' : expertData.role === 'synthesis' ? '통합' : expertData.role} -</span> {E.name}
            </div>
            <div className="text-[10px] uppercase font-black tracking-wider text-neutral-400">{expertData.role}</div>
          </div>
       </div>
       <div className="w-full pl-10 pr-4">
          <div className="relative bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-[13px] leading-[1.8] text-neutral-800 font-medium">
             <div className={MARKDOWN_CLASSES}>
                 <Markdown>
                     {shouldExpand ? cleanFull : cleanShort}
                 </Markdown>
             </div>
             {expertData.fullContent && (
               <button
                 onClick={handleToggle}
                 className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 hover:text-black transition-colors uppercase tracking-widest"
               >
                 <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", shouldExpand && "rotate-180")} />
                 {shouldExpand ? '요약 닫기 (Collapse)' : '전문 보기 (Read More)'}
               </button>
             )}
          </div>
       </div>
    </div>
  );
});

const AIBubble = memo(({ node }: { node: AppNode }) => {
  const data = node.data as TurnGroupNodeData;
  const [isDebateOpen, setIsDebateOpen] = useState(false);
  const setSelectedNodeId = useStore(state => state.setSelectedNodeId);

  const cleanedFinalOutput = reorderLegacyFinalOutput(sanitize(data.finalOutput || ''))
        .replace(/###\s*8\.\d\s*\[?([^\]\n]+)\]?/g, '### $1')
        .replace(/8\.\d\s*\[?([^\]\n]+)\]?/g, '$1');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedFinalOutput);
    } catch (e) {
      console.error("복사에 실패했습니다.", e);
    }
  };

  const roles = [data.thesis, data.antithesis, data.support, data.synthesis].filter(
     (e): e is ExpertTurnData => !!e?.expertId
  );

  return (
    <div className="flex flex-col items-start w-full mb-8 relative group">
       {/* 1. 전문가 시퀀스 (단톡방) - 로딩 완료 시점에만 노출 */}
       {!data.loading && roles.map((expertData, i) => (
         <ExpertBubble
           key={i}
           expertData={expertData}
           bubbleId={`expert-bubble-${node.id}-${expertData.role}`}
         />
       ))}

       {/* 2. 최종 결론부 (시스템) */}
       <div className="flex items-center gap-2 mb-3 w-full justify-between px-1 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg">
               <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-[12px] font-black tracking-widest text-black">FINAL OUTPUT</span>
          </div>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg shadow-sm text-[10px] font-bold tracking-wider text-black hover:bg-neutral-50 transition-colors"
                title="결론 복사"
             >
                <Copy className="h-3 w-3" /> COPY
             </button>
             <button 
                onClick={() => {
                   const parentEdge = useStore.getState().edges.find(e => e.target === node.id);
                   if (parentEdge) {
                      useStore.getState().reGenerateFromPrompt(parentEdge.source);
                   }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg shadow-sm text-[10px] font-bold tracking-wider text-black hover:bg-neutral-50 transition-colors"
                title="다시 생성하기"
             >
                <RefreshCw className="h-3 w-3" /> RE-GENERATE
             </button>
          </div>
       </div>

       {data.loading ? (
           <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl animate-pulse ml-10">
             <Loader2 className="w-4 h-4 animate-spin text-black" />
             <span className="text-[12px] font-bold text-neutral-500">분석 및 전략 수립 중...</span>
           </div>
       ) : (
           <div className="w-full pl-10 pr-4">
              <div className={cn(MARKDOWN_CLASSES, "bg-neutral-50 border border-neutral-100 rounded-2xl p-5 shadow-sm")}>
                 <Markdown>{cleanedFinalOutput.replace(/###\s*Final Strategic Output/g, '')}</Markdown>
              </div>
              
              <div className="mt-8 border border-neutral-100 rounded-2xl bg-[#fafafa] overflow-hidden">
                 <button 
                    onClick={() => setIsDebateOpen(!isDebateOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-neutral-100/50 transition-colors"
                 >
                    <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                        <Bot className="w-4 h-4" /> View Metacognitive Log & Process
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", isDebateOpen && "rotate-180")} />
                 </button>
                 
                 {isDebateOpen && (
                    <div className="p-5 border-t border-neutral-100 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                       <div className="text-[12px] leading-relaxed text-neutral-700 whitespace-pre-wrap font-medium">
                          {data.workflowSimulationLog}
                       </div>
                       <div className="text-[12px] leading-relaxed text-neutral-700 whitespace-pre-wrap font-medium mt-4">
                          {data.transparencyReport ? `[자기 치유 로그]\n${data.transparencyReport.selfHealingLog}` : ''}
                       </div>
                    </div>
                 )}
              </div>
           </div>
       )}
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

  const [chatInput, setChatInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastActiveNodeId = useStore(state => state.lastActiveNodeId);

  // 첨부파일 플로우 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatImage, setChatImage] = useState<string | undefined>(undefined);

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
          alert('AI 분석이 진행 중이거나 응답 생성이 제한된 구간입니다. AI 응답 말풍선의 RE-GENERATE 기능을 통해 재생성을 시도해 주세요.');
       }
    }
  };

  return (
    <div
      className={cn(
        'absolute top-4 bottom-4 z-40 flex items-start',
        !isResizing && 'transition-all duration-300 ease-out'
      )}
      style={{
        right: isRightPanelOpen ? 16 : -rightPanelWidth,
        width: rightPanelWidth
      }}
    >
      <button
        onClick={toggleRightPanel}
        className={cn(
          "absolute top-4 -left-14 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-md border border-neutral-200 transition-all z-40",
          isRightPanelOpen 
            ? "hover:bg-neutral-50 text-neutral-600" 
            : "hover:bg-neutral-50 text-black shadow-lg"
        )}
        title={isRightPanelOpen ? 'Close Panel' : 'Open Panel'}
      >
        {isRightPanelOpen ? <ChevronRight className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
      </button>

      <div 
        className="flex h-full w-full flex-col bg-white shadow-[0_8px_32px_rgb(0,0,0,0.06)] border border-neutral-200/60 rounded-[32px] overflow-hidden backdrop-blur-xl relative"
        style={{ minWidth: 400 }}
      >
        {isRightPanelOpen && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className={cn(
              "absolute left-[-6px] top-0 bottom-0 w-[12px] cursor-col-resize z-[60] group flex items-center justify-center transition-all",
              isResizing ? "bg-black/5" : "hover:bg-black/[0.02]"
            )}
          >
            <div className={cn(
              "h-10 w-[3px] rounded-full bg-neutral-200 transition-all group-hover:bg-neutral-400",
              isResizing && "bg-black h-16 w-[4px]"
            )} />
          </div>
        )}
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white/90 backdrop-blur-md rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
             <Bot className="h-5 w-5 text-black" />
             <span className="text-[12px] font-black uppercase tracking-[0.2em] text-black">Workspace Chat</span>
          </div>
        </div>

        {/* Chat History View */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-32">
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

        {/* Floating Input Bar (Gemini Style) */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-12 rounded-b-2xl">
           <div className="relative flex items-end w-full bg-neutral-100/60 rounded-[28px] border border-neutral-200 transition-all focus-within:bg-white focus-within:border-black focus-within:shadow-md">
              <button
                onClick={() => setIsModalOpen(true)}
                className="absolute left-3 bottom-2.5 p-2 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors z-10"
                title="Attach Image"
              >
                {chatImage ? (
                  <div className="relative">
                    <img src={chatImage} alt="Attachment Thumbnail" className="w-5 h-5 rounded object-cover" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 border border-white rounded-full"></div>
                  </div>
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </button>
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
                 className="flex-1 max-h-[200px] min-h-[56px] py-4 pl-12 pr-14 bg-transparent text-[13px] font-medium leading-relaxed text-black placeholder-neutral-400 resize-none outline-none custom-scrollbar disabled:opacity-50"
              />
              <button
                 onClick={handleChatSubmit}
                 disabled={!chatInput.trim() || isGenerating}
                 className="absolute right-2 bottom-2 p-2.5 rounded-full bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors shadow-sm"
              >
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
           </div>
           <div className="mt-3 text-center">
             <span className="text-[9px] font-bold text-neutral-300 tracking-wider">
               © CRETE CO., LTD. 2025. ALL RIGHTS RESERVED.
             </span>
           </div>
        </div>
        <AttachmentModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          image={chatImage} 
          onImageChange={setChatImage} 
        />
      </div>
    </div>
  );
});
