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
import { Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StickyNode } from './nodes/StickyNode';

import { DiscussionNode } from './nodes/DiscussionNode';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { TurnGroupNode } from './nodes/TurnGroupNode';
import { SynapseNode } from './nodes/SynapseNode';
import { ProtocolEdge } from './edges/ProtocolEdge';
import { AppNode } from '../types/nodes';

const nodeTypes = {
  sticky: StickyNode,
  turnGroup: TurnGroupNode,
  promptNode: StickyNode, // [HOTFIX] 레거시 DB(IndexedDB) promptNode 호환 맵핑
  discussion: DiscussionNode,
  synapseNode: SynapseNode,
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
    isRightPanelOpen,
    deleteNodes,
    isGenerating,
    toolMode,
    selectedNodeId,
  } = useStore();
  
  const { fitView, setCenter, getZoom } = useReactFlow();

  // [NEW] Generate 시작 시 1회성 화면 정렬 (화면 50%를 덮기 때문에, 포커스된 노드를 왼쪽 공간 중앙에 오도록 합니다.)
  useEffect(() => {
    if (isGenerating && selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        const currentZoom = getZoom() || 1;
        // x오프셋: 화면 너비의 1/4 / zoom 정도를 더해주어 대상 위치를 가리키게 하여, 결과적으로 노드가 왼쪽 절반의 중앙에 놓이게 함.
        const targetX = node.position.x + (node.measured?.width || 300) / 2 + (window.innerWidth / 4) / currentZoom;
        const targetY = node.position.y + (node.measured?.height || 150) / 2;
        setCenter(targetX, targetY, { zoom: currentZoom, duration: 800 });
      }
    }
  }, [isGenerating]);


  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    if (toolMode === 'pan') return; // pan 모드에서는 노드 클릭 무시
    if (event.shiftKey) return;
    setSelectedNodeId(node.id);
    setRightPanelOpen(true);
  }, [toolMode, setSelectedNodeId, setRightPanelOpen]);

  const handleSelectionChange = useCallback(({ nodes }: { nodes: AppNode[] }) => {
    const ids = nodes.map((n) => n.id);
    setSelectedNodeIds(ids);
    // 2개 이상 선택 시 우측 패널을 열어 통합 생성 유도
    if (ids.length > 1) {
      setRightPanelOpen(true);
    }
  }, [setSelectedNodeIds, setRightPanelOpen]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    // setRightPanelOpen(false); // 빈 영역 클릭 시 패널이 닫히지 않도록 주석 처리
  }, [setSelectedNodeId, setSelectedNodeIds]);

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
        onNodesDelete={(deleted) => deleteNodes(deleted.map(n => n.id))}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'protocolEdge' }}
        panOnScroll={false}
        selectionOnDrag={toolMode === 'lasso'}
        panOnDrag={toolMode === 'pan' ? true : [1, 2]}
        elementsSelectable={toolMode !== 'pan'}
        nodesDraggable={toolMode !== 'pan'}
        zoomOnScroll={true}
        minZoom={0.1}
        maxZoom={4}
        className={toolMode === 'pan' ? 'bg-neutral-50 cursor-grab active:cursor-grabbing' : 'bg-neutral-50'}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={20} color="#f2f2f2" lineWidth={1} />
        <Background variant={BackgroundVariant.Lines} gap={100} color="#f2f2f2" lineWidth={1} />
        
        {/* [NEW] 톱니바퀴 Settings 버튼 추가 (패널이 닫혀있을 때만 노출) */}
        {!isRightPanelOpen && (
          <Panel position="top-right" className="m-4 z-50">
            <button
              onClick={() => setRightPanelOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-black transition-all"
              title="Open Settings Panel"
            >
              <Settings className="h-5 w-5" />
            </button>
          </Panel>
        )}
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
