import { memo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { useReactFlow } from '@xyflow/react';
import {
  MousePointer2,
  Hand,
  Lasso,
  MessageSquare,
  Undo2,
  Redo2,
  ImageUp,
  Scan,
  Minus,
  Plus,
  Box,
  Library,
  Copy,
  Trash2,
  ClipboardCheck,
} from 'lucide-react';

export const LeftPanel = memo(() => {
  const { nodes, toolMode, setToolMode, addNode, isRightPanelOpen, rightPanelWidth, isLeftPanelOpen, snippets, addSnippet, deleteSnippet } = useStore();
  const { zoomIn, zoomOut, fitView, getViewport, setViewport } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);

  // 줌 레벨 폴링 동기화
  useEffect(() => {
    const interval = setInterval(() => {
      setZoomLevel(Math.round(getViewport().zoom * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [getViewport]);

  const handleAddSticky = () => {
    addNode({
      id: `sticky-${Date.now()}`,
      type: 'sticky',
      position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
      data: { text: '' },
    });
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        try {
          const { resizeImageLocal } = await import('../lib/utils');
          const optimizedDataUrl = await resizeImageLocal(file, 1024);
          
          addNode({
            id: `image-${Date.now()}`,
            type: 'imageNode',
            position: { x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 - 100 },
            data: { 
              imageUrl: optimizedDataUrl,
              filename: file.name,
              optimized: true
            },
          });
        } catch (error) {
          console.error("Image upload failed", error);
        }
      }
    };
    input.click();
  };

  // 커서/손 토글: select ↔ pan
  const handleCursorHandToggle = () => {
    setToolMode(toolMode === 'select' ? 'pan' : 'select');
  };

  // 화면에 맞추기 (수동 정밀 계산 방식)
  const handleFitView = () => {
    if (nodes.length === 0) return;

    // 1. 노드들의 전체 바운딩 박스 계산
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const w = node.measured?.width ?? 300; // 측정 전이면 기본값 사용
      const h = node.measured?.height ?? 200;

      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
      if (y + h > maxY) maxY = y + h;
    });

    const nodesWidth = maxX - minX;
    const nodesHeight = maxY - minY;

    // 2. 가용 캔버스 영역 계산
    const sidebarWidth = 85;
    const panelWidth = isRightPanelOpen ? rightPanelWidth : 0;
    const availableWidth = window.innerWidth - sidebarWidth - panelWidth - 60; // 좌우 여백 60px
    const availableHeight = window.innerHeight - 80; // 상하 여백 80px

    // 3. 줌 배율 계산 (가용 영역에 꽉 차도록)
    let zoom = Math.min(availableWidth / nodesWidth, availableHeight / nodesHeight);
    zoom = Math.min(Math.max(zoom, 0.1), 1.0); // 줌 범위 제한 (0.1 ~ 1.0)

    // 4. 중앙 좌표 계산 (가시 영역의 정중앙)
    const centerX = minX + nodesWidth / 2;
    const centerY = minY + nodesHeight / 2;

    const targetX = sidebarWidth + (availableWidth / 2 + 30) - (centerX * zoom);
    const targetY = (window.innerHeight / 2) - (centerY * zoom);

    // 5. 뷰포트 강제 설정
    setViewport({ x: targetX, y: targetY, zoom }, { duration: 800 });
  };

  // 커서/손 버튼 활성 여부 (lasso 모드가 아닐 때 활성)
  const isCursorHandActive = toolMode === 'select' || toolMode === 'pan';

  const [activeTab, setActiveTab] = useState<'sessions' | 'snippets'>('sessions');

  // 아이콘 공통 프롭스 (1.5px 굵기로 세련되게)
  const iconProps = {
    size: 16,
    strokeWidth: 1.5,
  };

  return (
    <>
      {/* ── Library Panel (좌측 트레이) ── */}
      <div 
        className={cn(
          "absolute left-4 top-20 bottom-4 w-72 bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgb(0,0,0,0.06)] border border-neutral-200/50 z-30 transition-all duration-300 ease-out flex flex-col overflow-hidden",
          isLeftPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center w-full px-4 pt-4 pb-2 border-b border-neutral-100 gap-4">
          <button 
            onClick={() => setActiveTab('sessions')}
            className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", activeTab === 'sessions' ? "text-black" : "text-neutral-400 hover:text-neutral-600")}
          >
            SESSIONS
          </button>
          <button 
            onClick={() => setActiveTab('snippets')}
            className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", activeTab === 'snippets' ? "text-black" : "text-neutral-400 hover:text-neutral-600")}
          >
            NODE
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {activeTab === 'sessions' ? (
            <div className="flex flex-col gap-2">
              {/* 임시 세션 데이터 */}
              <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 cursor-pointer transition-colors">
                <h4 className="text-[12px] font-bold text-neutral-800 mb-1">Current Session</h4>
                <p className="text-[10px] text-neutral-400">진행 중인 캔버스 대화 기록</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {snippets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <ImageUp className="w-8 h-8 text-neutral-300 mb-2" />
                  <p className="text-[10px] font-bold tracking-widest text-neutral-400 text-center">컨버스에 이미지를<br/>드래그하거나 더하기 해주세요</p>
                </div>
              ) : (
                snippets.slice().reverse().map((s) => (
                  <div key={s.id} className="group relative p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 cursor-pointer transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-neutral-800 truncate flex-1">{s.title}</h4>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => navigator.clipboard.writeText(s.content)}
                          className="p-1 text-neutral-400 hover:text-black transition-colors rounded"
                          title="클립보드 복사"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteSnippet(s.id)}
                          className="p-1 text-neutral-400 hover:text-red-500 transition-colors rounded"
                          title="스니펫 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] text-neutral-400 mt-0.5 line-clamp-2 leading-relaxed">{s.content.slice(0, 60)}...</p>
                    <p className="text-[9px] text-neutral-300 mt-1">{new Date(s.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Toolbars ── */}
      <div 
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3 transition-all duration-300 ease-out",
          isLeftPanelOpen ? "left-80" : "left-6"
        )}
      >

      <div className="flex flex-col gap-2">
        {/* ── 1. 서랍 패널 토글 버튼 (독립된 원형) ── */}
        <button
          onClick={() => useStore.getState().toggleLeftPanel()}
          title="라이브러리 토글"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white shadow-lg hover:opacity-80 transition-all active:scale-95"
        >
          <Library {...iconProps} />
        </button>

        {/* ── 2. 이미지 업로드 버튼 ── */}
        <button
          onClick={handleAddImage}
          title="이미지 업로드"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white shadow-lg hover:opacity-80 transition-all active:scale-95"
        >
          <ImageUp {...iconProps} />
        </button>
      </div>

      {/* ── 2. 도구 Pill ── */}
      <div className="flex flex-col items-center gap-1 p-1 rounded-full bg-white/90 backdrop-blur-md border border-neutral-200/50 shadow-[0_8px_32px_rgb(0,0,0,0.06)]">

        {/* 커서 / 손 토글 버튼 */}
        <button
          title={toolMode === 'pan' ? '손 모드' : '커서 모드'}
          onClick={handleCursorHandToggle}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-all',
            isCursorHandActive
              ? 'bg-black text-white'
              : 'text-neutral-500 hover:bg-neutral-100'
          )}
        >
          {toolMode === 'pan'
            ? <Hand {...iconProps} />
            : <MousePointer2 {...iconProps} />
          }
        </button>

        {/* 올가미 (Lasso) */}
        <button
          title="올가미 (다중 선택)"
          onClick={() => setToolMode('lasso')}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-all',
            toolMode === 'lasso'
              ? 'bg-black text-white'
              : 'text-neutral-500 hover:bg-neutral-100'
          )}
        >
          <Lasso {...iconProps} />
        </button>

        <div className="w-6 h-px bg-neutral-100 my-0.5" />

        {/* 텍스트 노드 추가 */}
        <button
          title="텍스트 노드 추가"
          onClick={handleAddSticky}
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 transition-all"
        >
          <MessageSquare {...iconProps} />
        </button>

        <div className="w-6 h-px bg-neutral-100 my-0.5" />

        {/* Undo */}
        <button
          title="되돌리기"
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 transition-all focus:outline-none"
        >
          <Undo2 {...iconProps} />
        </button>

        {/* Redo */}
        <button
          title="다시 실행"
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 transition-all focus:outline-none"
        >
          <Redo2 {...iconProps} />
        </button>
      </div>

      {/* ── 3. 줌 컨트롤 Pill ── */}
      <div className="flex flex-col items-center gap-1 p-1 rounded-full bg-white/90 backdrop-blur-md border border-neutral-200/50 shadow-[0_8px_32px_rgb(0,0,0,0.06)]">

        {/* Fit to Screen */}
        <button
          title="화면에 맞추기"
          onClick={handleFitView}
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 transition-all"
        >
          <Scan {...iconProps} />
        </button>

        <div className="w-6 h-px bg-neutral-100 my-0.5" />

        {/* Zoom In */}
        <button
          title="확대"
          onClick={() => zoomIn({ duration: 200 })}
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 transition-all"
        >
          <Plus {...iconProps} />
        </button>

        {/* 줌 비율 */}
        <span className="text-[10px] font-bold text-neutral-400 select-none w-9 text-center py-1 tabular-nums">
          {zoomLevel}%
        </span>

        {/* Zoom Out */}
        <button
          title="축소"
          onClick={() => zoomOut({ duration: 200 })}
          className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 transition-all"
        >
          <Minus {...iconProps} />
        </button>
      </div>
      </div>
    </>
  );
});
