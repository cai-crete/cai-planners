import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store/useStore';
import { StickyNode } from './nodes/StickyNode';
import { DiscussionNode } from './nodes/DiscussionNode';
import { FloatingToolbar } from './FloatingToolbar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { TurnGroupNode } from './nodes/TurnGroupNode';
import { PromptNode } from './nodes/PromptNode';

const nodeTypes = {
  sticky: StickyNode,
  discussion: DiscussionNode,
  turnGroup: TurnGroupNode,
  promptNode: PromptNode,
};

function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    setRightPanelOpen,
    isGenerating,
    toolMode,
  } = useStore();
  
  const { fitView, setCenter } = useReactFlow();

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setRightPanelOpen(true);
  }, [setSelectedNodeId, setRightPanelOpen]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setRightPanelOpen(false);
  }, [setSelectedNodeId, setRightPanelOpen]);

  const handleRecenter = useCallback(() => {
    fitView({ duration: 800, padding: 0.2 });
  }, [fitView]);

  return (
    <div className="h-screen w-screen bg-neutral-50 relative overflow-hidden font-sans">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        panOnScroll={false}
        selectionOnDrag={toolMode === 'select'}
        panOnDrag={toolMode === 'pan' ? true : [1, 2]}
        zoomOnScroll={true}
        minZoom={0.1}
        maxZoom={4}
        className="bg-neutral-50"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={20} color="#e5e5e5" lineWidth={1} />
        <Background variant={BackgroundVariant.Lines} gap={100} color="#d4d4d4" lineWidth={1} />
        
        <Controls position="top-left" showInteractive={false} className="bg-white shadow-md border-neutral-200 ml-6 mt-6" />
        <MiniMap 
          nodeColor={(n) => {
            if (n.type === 'discussion') return n.data.type === 'synthesis' ? '#000' : '#ccc';
            return '#fff';
          }}
          maskColor="rgba(245, 245, 245, 0.7)"
          className="border border-neutral-200 shadow-sm rounded-lg overflow-hidden !mb-16 !ml-6"
          position="bottom-left"
        />
        
        <Panel position="bottom-left" className="mb-4 ml-6">
          <button
            onClick={handleRecenter}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-neutral-200 hover:bg-neutral-50 transition-colors text-neutral-600"
            title="Recenter Canvas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </Panel>

        <FloatingToolbar />
      </ReactFlow>

      <LeftPanel />
      <RightPanel />

      {isGenerating && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black px-6 py-3 text-sm font-medium text-white shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          전문가가 분석 중입니다...
        </div>
      )}
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
