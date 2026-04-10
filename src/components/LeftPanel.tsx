import { memo, useState } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import {
  ImageUp,
  Library,
  Copy,
  Trash2,
  Plus as PlusIcon
} from 'lucide-react';
import { isPromptNode, getPromptNodeData } from '../types/nodes';

// 프로젝트 nodes에서 첫 번째 유효한 프롬프트 텍스트 추출
// isPromptNode는 type === 'sticky' | 'promptNode' 모두 포함
function getProjectTitle(project: { name: string; nodes: any[] }): string {
  for (const n of project.nodes) {
    if (!isPromptNode(n)) continue;
    const pData = getPromptNodeData(n.data as any);
    // versions에서 텍스트 우선 탐색
    const versionText = pData.versions?.find((v: any) => v.text?.trim())?.text?.trim();
    if (versionText) return versionText.length > 36 ? versionText.substring(0, 36) + '…' : versionText;
    // 폴백: plain text 필드
    const plainText = (pData as any).text?.trim?.();
    if (plainText) return plainText.length > 36 ? plainText.substring(0, 36) + '…' : plainText;
  }
  return project.name;
}

export const LeftPanel = memo(() => {
  const { isLeftPanelOpen, snippets, deleteSnippet, projects, currentProjectId, loadProjectData, deleteProjectData, createNewProject } = useStore();
  const [activeTab, setActiveTab] = useState<'sessions' | 'snippets'>('sessions');

  const iconProps = {
    size: 16,
    strokeWidth: 1.5,
  };

  return (
    <>
      {/* ── Library Panel (좌측 트레이) ── */}
      <div 
        className={cn(
          "absolute left-4 top-4 bottom-4 w-72 bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_rgb(0,0,0,0.06)] border border-neutral-200/50 z-50 transition-all duration-300 ease-out flex flex-col overflow-hidden",
          isLeftPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
        )}
      >
        <div className="p-4 border-b border-neutral-100">
           <button 
              onClick={() => createNewProject()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl hover:bg-neutral-800 transition-all shadow-sm group"
           >
              <PlusIcon className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span className="text-[11px] font-black uppercase tracking-widest">New Chat</span>
           </button>
        </div>

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
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Library className="w-8 h-8 text-neutral-300 mb-2" />
                  <p className="text-[10px] font-bold tracking-widest text-neutral-400 text-center">저장된 세션이 없습니다</p>
                </div>
              ) : (
                projects.map((project) => {
                  const isActive = currentProjectId === project.id;
                  const title = getProjectTitle(project as any);
                  return (
                    <div
                      key={project.id}
                      onClick={() => loadProjectData(project.id)}
                      className={cn(
                        "group relative p-3 rounded-xl border cursor-pointer transition-colors",
                        isActive ? "border-black bg-black text-white" : "border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className={cn("text-[12px] font-bold mb-1 leading-tight flex-1 min-w-0", isActive ? "text-white" : "text-neutral-800")}>
                          {title}
                        </h4>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProjectData(project.id); }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded flex-shrink-0",
                            isActive ? "text-neutral-400 hover:text-red-300" : "text-neutral-300 hover:text-red-500"
                          )}
                          title="세션 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className={cn("text-[9px]", isActive ? "text-neutral-300" : "text-neutral-400")}>
                        {new Date(project.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })
              )}
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
    </>
  );
});
