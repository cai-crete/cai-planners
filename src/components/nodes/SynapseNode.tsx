import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { 
  Zap, Compass, Target, Layers, ArrowRight, Trash2, 
  Search, GitBranch, Shield, Orbit, Box, Bot, Sparkles,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn, sanitize } from '../../lib/utils';
import { SynapseNodeData, RootSeedData, SynthesizedSeedData } from '../../types/synapse';
import Markdown from 'react-markdown';

export const SynapseNode = memo(({ id, data, selected }: NodeProps<Node<SynapseNodeData>>) => {
  const deleteNode = useStore(state => state.deleteNode);
  const phase = data.phase;
  const isLoading = data.loading;

  // Phase별 아이콘 및 테마 설정
  const phaseConfig = {
    germination: {
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      label: 'INITIAL SEED (PHASE 1)',
      color: 'border-amber-100 bg-amber-50/30'
    },
    expansion: {
      icon: <GitBranch className="w-4 h-4 text-blue-500" />,
      label: 'EXPANSION (PHASE 2)',
      color: 'border-blue-100 bg-blue-50/30'
    },
    convergence: {
      icon: <Orbit className="w-4 h-4 text-purple-500" />,
      label: 'CONVERGENCE (PHASE 3)',
      color: 'border-purple-100 bg-purple-50/30'
    },
    extraction: {
      icon: <Box className="w-4 h-4 text-emerald-500" />,
      label: 'EXTRACTION (PHASE 4)',
      color: 'border-emerald-100 bg-emerald-50/30'
    }
  };

  const config = phaseConfig[phase] || phaseConfig.germination;

  return (
    <div className={cn(
      "w-[500px] rounded-[40px] border bg-white shadow-2xl transition-all duration-500 p-8 flex flex-col gap-6 relative overflow-hidden",
      selected ? "border-black ring-4 ring-black/10" : "border-neutral-200",
      isLoading && "animate-pulse"
    )}>
      {/* 계보 색상 악센트 (Left Border) */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2.5 transition-colors duration-500"
        style={{ backgroundColor: data.versionColor || '#F3F4F6' }}
      />
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-xl shadow-sm", config.color)}>
            {isLoading ? <Sparkles className="w-4 h-4 text-neutral-400 animate-spin" /> : config.icon}
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
            {isLoading ? 'ANALYZING...' : config.label}
          </span>
        </div>
        <button 
          onClick={() => deleteNode(id)}
          className="p-2 hover:bg-red-50 rounded-full transition-colors group"
        >
          <Trash2 className="w-4 h-4 text-neutral-300 group-hover:text-red-500" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col gap-5">
        {isLoading ? (
          // Skeleton State
          <div className="flex flex-col gap-4">
            <div className="h-6 bg-neutral-100 rounded-lg w-3/4 animate-pulse" />
            <div className="h-20 bg-neutral-50 rounded-2xl w-full animate-pulse" />
          </div>
        ) : (
          <>
            {/* Phase 1: Germination View */}
            {phase === 'germination' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-neutral-900 tracking-tight leading-tight">
                  {(data.data as RootSeedData).coreIntention}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(data.data as RootSeedData).context?.map((c, i) => (
                    <span key={i} className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-[11px] font-bold">
                      # {c}
                    </span>
                  ))}
                </div>
                {((data.data as RootSeedData).subBranches?.length ?? 0) > 0 && (
                  <div className="mt-2 pt-4 border-t border-neutral-100">
                    <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-3">Next Expansions</p>
                    <div className="flex flex-col gap-2">
                      {(data.data as RootSeedData).subBranches.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12px] font-bold text-neutral-700 hover:text-black cursor-pointer group">
                          <div className="w-4 h-[1px] bg-neutral-200 group-hover:w-6 transition-all" />
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phase 3 & 4: Convergence/Extraction View */}
            {(phase === 'convergence' || phase === 'extraction') && (
              <div className="flex flex-col gap-6">
                <div className="p-6 bg-neutral-50/50 rounded-[28px] border border-neutral-100 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 bg-black rounded-lg shadow-lg">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.2em] text-neutral-400 uppercase">Master Insight</span>
                  </div>
                  <h3 className="text-[17px] font-black leading-tight tracking-tight text-neutral-900">
                    {(data.data as SynthesizedSeedData).synthesizedInsight}
                  </h3>
                </div>

                <div className="space-y-4 px-1">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Final Extraction</span>
                  </div>
                  <div className="compact-markdown prose prose-neutral prose-sm max-w-none text-neutral-800 font-medium leading-[1.8] select-text">
                    <Markdown>{(data.data as SynthesizedSeedData).finalOutput || ''}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
