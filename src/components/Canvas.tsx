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
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { TurnGroupNode } from './nodes/TurnGroupNode';
import { PromptNode } from './nodes/PromptNode';
import { ProtocolEdge } from './edges/ProtocolEdge';

const nodeTypes = {
  sticky: StickyNode,
  discussion: DiscussionNode,
  turnGroup: TurnGroupNode,
  promptNode: PromptNode,
};

const edgeTypes = {
  protocolEdge: ProtocolEdge,
};

function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    setSelectedNodeIds,
    setRightPanelOpen,
    isGenerating,
    toolMode,
  } = useStore();
  
  const { fitView, setCenter } = useReactFlow();

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setRightPanelOpen(true);
  }, [setSelectedNodeId, setRightPanelOpen]);

  const handleSelectionChange = useCallback(({ nodes }: { nodes: any[] }) => {
    const ids = nodes.map((n) => n.id);
    setSelectedNodeIds(ids);
    // 2개 이상 선택 시 우측 패널을 열어 통합 생성 유도
    if (ids.length > 1) {
      setRightPanelOpen(true);
    }
  }, [setSelectedNodeIds, setRightPanelOpen]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setRightPanelOpen(false);
  }, [setSelectedNodeId, setRightPanelOpen]);

  const handleRecenter = useCallback(() => {
    fitView({ duration: 800, padding: 0.2 });
  }, [fitView]);

  return (
    <div className="h-screen w-screen bg-[#fcfcfc] relative overflow-hidden font-sans">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'protocolEdge' }}
        panOnScroll={false}
        selectionOnDrag={toolMode === 'select'}
        panOnDrag={toolMode === 'pan' ? true : [1, 2]}
        zoomOnScroll={true}
        minZoom={0.1}
        maxZoom={4}
        className="bg-neutral-50"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={20} color="#f2f2f2" lineWidth={1} />
        <Background variant={BackgroundVariant.Lines} gap={100} color="#f2f2f2" lineWidth={1} />
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
