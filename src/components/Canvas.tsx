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
import { AppNode, isStickyNode } from '../types/nodes';
import { ImageNode } from './nodes/ImageNode';
import { resizeImageLocal } from '../lib/utils';

const nodeTypes = {
  sticky: StickyNode,
  turnGroup: TurnGroupNode,
  promptNode: StickyNode, // [HOTFIX] 레거시 DB 호환
  discussion: DiscussionNode,
  synapseNode: SynapseNode,
  imageNode: ImageNode,
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
  
  const { fitView, setCenter, getZoom, screenToFlowPosition } = useReactFlow();

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        
        try {
          const optimizedDataUrl = await resizeImageLocal(file, 1024);
          
          useStore.getState().addNode({
            id: `image-${Date.now()}`,
            type: 'imageNode',
            position,
            data: { 
              imageUrl: optimizedDataUrl,
              filename: file.name,
              optimized: true
            },
          });
        } catch (error) {
          console.error("Image resize failed", error);
        }
      }
    }
  }, [screenToFlowPosition]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // [NEW] Generate 시작 시 화면 정렬 로직 (부모-자식 노드 동시 표시)
  useEffect(() => {
    if (isGenerating && selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        // 직전 프롬프트 노드(부모) 조회
        const incomingEdge = edges.find(e => e.target === selectedNodeId);
        let parentNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
        
        let targetNodes = [node];
        if (parentNode) targetNodes.push(parentNode);

        const xMin = Math.min(...targetNodes.map(n => n.position.x));
        const yMin = Math.min(...targetNodes.map(n => n.position.y));
        // 노드 넓이/높이는 measured 값을 우선 사용하되, 없으면 기본값 반영(Sticky 300x150, TurnGroup 540x300 추정)
        const xMax = Math.max(...targetNodes.map(n => n.position.x + (n.measured?.width || (isStickyNode(n) ? 300 : 540))));
        const yMax = Math.max(...targetNodes.map(n => n.position.y + (n.measured?.height || 300)));

        const boundsWidth = xMax - xMin;
        const boundsHeight = yMax - yMin;
        const centerX = xMin + boundsWidth / 2;
        const centerY = yMin + boundsHeight / 2;

        // 좌측 40% 공간 여유 공간
        const containerWidth = window.innerWidth * 0.4;
        const containerHeight = window.innerHeight;

        // 좌우 패딩을 150px씩 여유를 둬서 잘리지 않게 설정
        const zoomX = containerWidth / (boundsWidth + 150);
        const zoomY = containerHeight / (boundsHeight + 150);
        const newZoom = Math.max(0.2, Math.min(zoomX, zoomY, 1.2)); // 최소 0.2배, 최대 1.2배

        // 화면 중앙(0.5 W)에서 카메라를 우측으로 시프트(+ 0.3 W)하여 대상물이 좌측 20% 중앙에 오도록 처리
        const targetX = centerX + (window.innerWidth * 0.3) / newZoom;

        setCenter(targetX, centerY, { zoom: newZoom, duration: 800 });
      }
    }
  }, [isGenerating, nodes, edges, setCenter]);


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
    // 첫 시작화면 이후 클릭 시 라이브러리를 닫아서 기본 닫힘 상태 유지
    useStore.getState().setLeftPanelOpen(false);
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
        onDrop={handleDrop}
        onDragOver={handleDragOver}
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
