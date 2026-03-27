import { memo, useMemo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useStore as useRFStore } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export const ProtocolEdge = memo(({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const selectedNodeIds = useStore((state) => state.selectedNodeIds);
  const edges = useStore((state) => state.edges);

  // 현재 선택된 노드들로부터 루트까지 역방향으로 경로 탐색하여 자신이 포함되어 있는지 확인
  const isHighlighted = useMemo(() => {
    if (!selectedNodeIds || selectedNodeIds.length === 0) return false;

    for (const selId of selectedNodeIds) {
      // "groupId::role" 형태인 경우 groupId로 치환
      const actualSelectedId = selId.includes('::') 
        ? selId.split('::')[0] 
        : selId;

      let currentId = actualSelectedId;
      const visited = new Set<string>();

      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const parentEdge = edges.find(e => e.target === currentId);
        if (parentEdge) {
          if (parentEdge.id === id) return true;
          currentId = parentEdge.source;
        } else {
          break;
        }
      }
    }
    return false;
  }, [selectedNodeIds, edges, id]);

  const protocol = (data?.protocol as string) || 'default';

  // 프로토콜별 기본 스타일 정의
  const getBaseStyle = () => {
    switch (protocol) {
      case 'inception':
        return { stroke: '#CBD5E1', strokeWidth: 1.5, strokeDasharray: '5,5' }; // 회색 점선
      case 'dialectic':
        return { stroke: '#94A3B8', strokeWidth: 2 }; // 중간 회석 실선
      case 'evolution':
        return { stroke: '#64748B', strokeWidth: 2 }; // 짙은 회색 실선
      default:
        return { stroke: '#E2E8F0', strokeWidth: 1.5 };
    }
  };

  const finalStyle = isHighlighted
    ? {
        ...style,
        stroke: '#000000',
        strokeWidth: 3,
        transition: 'all 0.3s ease-in-out',
        strokeDasharray: 'none', // 하이라이트 시 점선 제거
      }
    : {
        ...style,
        ...getBaseStyle(),
        transition: 'all 0.3s ease-in-out',
      };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={finalStyle}
        interactionWidth={20}
      />
      {isHighlighted && (
        <circle r="3" fill="#000">
          <animateMotion 
            dur="2s" 
            repeatCount="indefinite" 
            path={edgePath} 
          />
        </circle>
      )}
    </>
  );
});
