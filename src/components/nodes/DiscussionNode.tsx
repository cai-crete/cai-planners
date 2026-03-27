import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { EXPERTS } from '../../lib/experts';
import { useStore } from '../../store/useStore';

export type DiscussionType = 'thesis' | 'antithesis' | 'synthesis';

export interface DiscussionNodeData extends Record<string, unknown> {
  type: DiscussionType;
  expertId: string;
  content: string;
  turn: number;
}

export const DiscussionNode = memo(({ id, data, selected }: NodeProps<Node<DiscussionNodeData>>) => {
  const expert = EXPERTS.find((e) => e.id === data.expertId);
  const selectedNodeId = useStore((state) => state.selectedNodeId);

  const getTypeStyles = () => {
    switch (data.type) {
      case 'thesis':
        return 'border-neutral-300 bg-white';
      case 'antithesis':
        return 'border-black bg-neutral-50';
      case 'synthesis':
        return 'border-black bg-black text-white';
      default:
        return 'border-neutral-200 bg-white';
    }
  };

  const getLabel = () => {
    switch (data.type) {
      case 'thesis': return '제안 (Thesis)';
      case 'antithesis': return '반박 (Antithesis)';
      case 'synthesis': return '통합 (Synthesis)';
    }
  };

  return (
    <div
      className={cn(
        'relative w-80 rounded-2xl border-2 p-5 shadow-lg transition-all',
        getTypeStyles(),
        (selected || selectedNodeId === id) ? 'border-black ring-2 ring-black/20' : 'border-neutral-200'
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {expert?.avatarUrl ? (
            <img src={expert.avatarUrl} alt={expert.name} className="h-10 w-10 rounded-full bg-neutral-200" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-neutral-200" />
          )}
          <div>
            <div className={cn("text-sm font-bold", data.type === 'synthesis' ? 'text-white' : 'text-black')}>
              {expert?.name || 'Unknown Expert'}
            </div>
            <div className={cn("text-xs", data.type === 'synthesis' ? 'text-neutral-300' : 'text-neutral-500')}>
              {expert?.group || 'Expert'}
            </div>
          </div>
        </div>
        <div className={cn(
          "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
          data.type === 'synthesis' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
        )}>
          Turn {data.turn}
        </div>
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">
        {getLabel()}
      </div>

      <div className={cn(
        "line-clamp-4 text-sm leading-relaxed",
        data.type === 'synthesis' ? 'text-neutral-200' : 'text-neutral-700'
      )}>
        {data.content}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
