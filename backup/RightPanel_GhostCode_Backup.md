# [Code Archive] RightPanel.tsx 유령 코드 (Ghost Code) 전용 백업

본 파일은 `RightPanel.tsx`에서 제거된 중복 코드의 전문을 보존합니다. 사용자님의 승인 하에 코드 내역을 없애지 않고 원형 그대로 기록하여, 나중에 직접 대조하고 확인하기 편하게 구성되었습니다.

---

## 1. 제거된 코드 실본 (Legacy Reference)

```tsx
  // 2. 단일 답변 또는 병렬 생성 후 선택이 확정된 경우 (상세 기획서 뷰)
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
    
    // 기획서 본문과 분석 로그를 결합하여 다운로드 (ID -> 역할명 변환 적용)
    const formattedLog = formatExpertText(data.workflowSimulationLog);
    const downloadContent = `[통합 전략 기획서]\n\n${cleanedFinalOutput}\n\n` + 
                          `================================================\n` +
                          `[WORKFLOW SIMULATION LOG - 분석 과정 기록]\n` +
                          `================================================\n\n` + 
                          `${formattedLog}`;

    const file = new Blob([downloadContent], {type: 'text/plain'});
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
                 {data.selectedGroupId && (
                   <span className="bg-black/5 px-2 py-0.5 rounded text-[9px] text-neutral-500 border border-black/10 flex items-center gap-1">
                     Group {data.selectedGroupId}
                     {data.parallelResults?.find(p => p.groupId === data.selectedGroupId)?.synergyScore && (
                       <span className="ml-1 pl-1 border-l border-black/10 font-black text-black/40">SC {data.parallelResults.find(p => p.groupId === data.selectedGroupId)?.synergyScore}</span>
                     )}
                   </span>
                 )}
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
                         {data.parallelResults.filter(p => p.groupId !== data.selectedGroupId).map(pResult => (
                            <div key={pResult.groupId} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col">
                               <div className="flex justify-between items-center mb-2">
                                  <div className="text-[10px] font-black uppercase text-neutral-400">그룹 {pResult.groupId}</div>
                                  {pResult.synergyScore && (
                                    <div className="text-[9px] font-black text-black/40">SC {pResult.synergyScore}</div>
                                  )}
                               </div>
                               <div className={cn(MARKDOWN_CLASSES, "text-[11px]")}><Markdown>{sanitize(pResult.data?.finalOutput || '데이터 없음')}</Markdown></div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}
             
             {/* 하단 액션 버튼 그룹 (Metacognitive Log 대체) */}
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
```

## 2. 참조 상세 (Context)
- 위 코드는 `AIBubble` 컴포넌트 내부에서 **병렬 생성 완료 후 또는 단일 답변 상태**에서 기획서 리포트를 그리는 실본 코드입니다.
- 561~737라인 영역에 잘못 중복 삽입되어 있던 것을 제거하기 전의 소스입니다.
- 현재 작동 중인 코드는 383~559라인에서 위와 동일한 로직(기능 강화 버전)으로 살아 있습니다.
---
백업일: 2026-04-10
상태: **코드 전문 복구 완료 (Archive Restored)**
