import { memo, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useReactFlow } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { generateDiscussion } from '../lib/gemini';

export const FloatingToolbar = memo(() => {
  const {
    nodes,
    isGenerating,
    setIsGenerating,
    addNode,
    onConnect,
    currentMode,
    selectedExpertIds,
    generationTurn,
    setGenerationTurn,
  } = useStore();
  const { getNodes } = useReactFlow();
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);

  useEffect(() => {
    const selected = nodes.filter((n) => n.selected);
    setSelectedNodes(selected);
  }, [nodes]);

  // 선택된 노드가 없거나, 생성 중이거나, 선택된 노드가 모두 turnGroup이면 툴바 숨김
  const hasTurnGroupOnly =
    selectedNodes.length > 0 && selectedNodes.every((n) => n.type === 'turnGroup');
  if (selectedNodes.length === 0 || isGenerating || hasTurnGroupOnly) {
    return null;
  }

  // 일반 스티키 노드만 대상
  const stickyNodes = selectedNodes.filter((n) => n.type !== 'turnGroup');
  if (stickyNodes.length === 0) return null;

  const handleGenerate = async () => {
    if (generationTurn >= 3) {
      alert('최대 턴(3턴)에 도달했습니다. 새로운 캔버스에서 시작하거나 다른 노드를 선택하세요.');
      return;
    }
    setIsGenerating(true);
    try {
      const context = stickyNodes
        .map((n) => n.data.fullText || n.data.text || n.data.content)
        .join('\n\n');
      const result = await generateDiscussion(context, currentMode, selectedExpertIds);

      const lastNode = stickyNodes[stickyNodes.length - 1];
      const currentTurn = generationTurn + 1;
      const groupId = `node-group-${Date.now()}`;

      addNode({
        id: groupId,
        type: 'turnGroup',
        position: { x: lastNode.position.x + 380, y: lastNode.position.y - 200 },
        data: {
          turn: currentTurn,
          thesis: result.thesis,
          antithesis: result.antithesis,
          synthesis: result.synthesis,
          support: result.support,
          finalOutput: result.finalOutput,
          // ⚠️ 함수 속성은 저장하지 않음 — TurnGroupNode가 스토어 액션을 직접 호출
        },
      } as any);

      stickyNodes.forEach((node) => {
        onConnect({ source: node.id, target: groupId, sourceHandle: null, targetHandle: null });
      });

      setGenerationTurn(currentTurn);
    } catch (error) {
      console.error('Generation failed:', error);
      alert('토론 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full bg-white px-6 py-3 shadow-2xl border border-neutral-200 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-neutral-600">
        {stickyNodes.length} node{stickyNodes.length > 1 ? 's' : ''} selected
      </span>
      <div className="h-4 w-px bg-neutral-200" />
      <button
        onClick={handleGenerate}
        className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 transition-colors"
      >
        <Sparkles className="h-4 w-4" /> GENERATE
      </button>
    </div>
  );
});
