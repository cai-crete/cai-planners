import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { ImageNodeData } from '../../types/nodes';
import { Trash2, Image as ImageIcon } from 'lucide-react';

export const ImageNode = memo(({ id, data, selected }: NodeProps<Node<ImageNodeData>>) => {
  const isGenerating = useStore((state) => state.isGenerating);
  const deleteNode = useStore((state) => state.deleteNode);
  const lastActiveNodeId = useStore((state) => state.lastActiveNodeId);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  return (
    <div
      className={cn(
        'w-[240px] rounded-2xl bg-white p-2 shadow-lg flex flex-col relative border-2 group transition-[border-color,box-shadow] duration-300',
        lastActiveNodeId === id ? 'border-black ring-2 ring-black/20' : 'border-neutral-200',
        isGenerating && 'opacity-80'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-neutral-800 opacity-50 hover:opacity-100" />

      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
          <ImageIcon className="w-3.5 h-3.5 text-black" />
          <span className="text-[10px] font-black tracking-widest uppercase text-black">
            Asset
            {data.optimized && <span className="ml-1 text-[8px] text-blue-500">[OPT]</span>}
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="text-neutral-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
          title="Delete Image"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden nodrag bg-neutral-100 flex items-center justify-center min-h-[140px]">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.filename || 'Image Asset'}
            className="w-full h-auto object-cover"
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <span className="text-xs text-neutral-400 font-bold">No Image</span>
        )}
      </div>
    </div>
  );
});
