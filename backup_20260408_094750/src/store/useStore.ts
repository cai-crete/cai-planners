import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { Project, saveProject, getProject, getAllProjects, deleteProject } from '../lib/db';
import { EXPERTS } from '../lib/experts';
import { regenerateDiscussion, generateDiscussion } from '../lib/gemini';
import { 
  AppNode, 
  AllNodeData,
  StickyNodeData, 
  TurnGroupNodeData, 
  PromptNodeData,
  PromptVersion,
  isStickyNode, 
  isTurnGroupNode, 
  isPromptNode,
  getPromptNodeData
} from '../types/nodes';

export const GEMS_PALETTE = [
  { main: '#3B82F6', pale: '#EFF6FF' }, // Blue (V2+)
  { main: '#10B981', pale: '#ECFDF5' }, // Green
  { main: '#8B5CF6', pale: '#F5F3FF' }, // Purple
  { main: '#F59E0B', pale: '#FFFBEB' }, // Orange
  { main: '#EF4444', pale: '#FEF2F2' }, // Red (Legacy)
  { main: '#EC4899', pale: '#FDF2F8' }, // Pink
];

export const INITIAL_GRAY = '#9CA3AF'; // Pure gray to prevent 'blue line' perception
export const LEGACY_RED   = '#EF4444';

export type AppMode = 'A' | 'B' | 'C' | null;

interface AppState {
  // React Flow State
  nodes: AppNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: AppNode) => void;
  updateNodeData: (id: string, data: Partial<AllNodeData>) => void;

  // Project State
  currentProjectId: string | null;
  projects: Project[];
  loadProjectsList: () => Promise<void>;
  createNewProject: () => void;
  loadProjectData: (id: string) => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  deleteProjectData: (id: string) => Promise<void>;

  // UI State
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toolMode: 'select' | 'pan' | 'lasso';
  setToolMode: (mode: 'select' | 'pan' | 'lasso') => void;

  // Expert & Generation State
  autoExpertMode: boolean;
  setAutoExpertMode: (val: boolean) => void;
  selectedExpertIds: string[];
  toggleExpertSelection: (id: string) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  currentMode: AppMode;
  setCurrentMode: (mode: AppMode) => void;
  generationTurn: number;
  setGenerationTurn: (turn: number) => void;

  // ─── 중앙 관리소: Re-generate 전용 액션 ───
  createPromptAndRegenerate: (sourceNodeId: string, prompt: string, imageData?: string) => Promise<void>;
  reGenerateFromPrompt: (promptNodeId: string) => Promise<void>;
  combineAndGenerateVCS: (sourceIds: string[], customPrompt?: string, forcedVersionColor?: string, imageData?: string) => Promise<void>;
  updatePromptTextWithBranching: (nodeId: string, versionId: string, newText: string, imageData?: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  deletePromptVersion: (nodeId: string, versionId: string) => void;
}

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges<AppNode>(changes, get().nodes),
    });
    // 드래그 진행 중(dragging===true)에는 저장 생략 → 매 프레임 IndexedDB I/O 방지
    // 드래그가 완료(dragging===false)되거나 다른 변경(선택, 삭제 등)일 때만 저장
    const isDragging = changes.some(
      (c) => c.type === 'position' && (c as any).dragging === true
    );
    if (!isDragging) {
      get().saveCurrentProject();
    }
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    get().saveCurrentProject();
  },
  onConnect: (connection) => {
    const state = get();
    const sourceNode = state.nodes.find(n => n.id === connection.source);
    let edgeColor = null;

    if (sourceNode && isPromptNode(sourceNode)) {
      const pData = getPromptNodeData(sourceNode.data);
      const currentVer = pData.versions.find(v => v.id === pData.currentVersionId);
      edgeColor = currentVer?.color || INITIAL_GRAY;
    }

    const newEdge = {
      ...connection,
      id: `e-${generateId()}`,
      type: 'protocolEdge',
      data: { 
        protocol: (connection as any).data?.protocol || 'evolution', 
        color: (connection as any).data?.color || edgeColor 
      }
    };
    set({
      edges: addEdge(newEdge as Edge, get().edges),
    });
    get().saveCurrentProject();
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
    get().saveCurrentProject();
  },
  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          if (isTurnGroupNode(node) || node.type === 'turnGroup') {
            const curData = node.data as any;
            const newData = data as any;
            const merged = { ...curData, ...newData };
            ['thesis', 'antithesis', 'synthesis', 'support'].forEach(r => {
              if (curData[r] && newData[r]) {
                merged[r] = { ...curData[r], ...newData[r] };
              }
            });
            return { ...node, data: merged };
          }
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      }),
    });
    get().saveCurrentProject();
  },
  updatePromptTextWithBranching: (nodeId, versionId, newText, imageData) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !isPromptNode(node)) return;

    const pData = getPromptNodeData(node.data);
    const versions = pData.versions;
    const currentVer = versions.find(v => v.id === versionId) || versions[0];

    // 현재 버전이 이미 결과물을 생성했는지 체크 (Edge 존재 여부)
    const hasExistingResult = state.edges.some(e => 
      e.source === nodeId && ((e.data as any)?.color === currentVer.color || (!(e.data as any)?.color && currentVer.id === 'v1'))
    );

    // 이미 결과가 있는 탭을 수정하려고 하면 즉시 분기 (최대 6개)
    if (hasExistingResult && versions.length < 6) {
      const nextIndex = versions.length; // 현재 1개면 nextIndex=1
      const newVerId = `v-${Date.now()}`;
      
      // [상태 전이] V1에서 V2로 넘어가는 첫 분기 시점
      let updatedVersions = [...versions];
      if (versions.length === 1 && versions[0].id === 'v1') {
        // 1. 기존 V1 탭을 Red로 전환
        updatedVersions[0] = { ...updatedVersions[0], color: LEGACY_RED };
        
        // 2. 기존 V1과 연결된 모든 엣지/노드 Red로 전환
        const v1Edges = state.edges.filter(e => e.source === nodeId && (!(e.data as any)?.color || (e.data as any)?.color === INITIAL_GRAY));
        v1Edges.forEach(e => {
          // 엣지 업데이트
          set(s => ({
            edges: s.edges.map(ed => ed.id === e.id ? { ...ed, data: { ...ed.data, color: LEGACY_RED } } : ed)
          }));
          // 연결된 노드 업데이트
          set(s => ({
            nodes: s.nodes.map(n => n.id === e.target ? { ...n, data: { ...n.data, versionColor: LEGACY_RED } } : n)
          }));
        });
      }

      const newVersion: PromptVersion = {
        id: newVerId,
        text: newText,
        color: GEMS_PALETTE[nextIndex - 1]?.main || GEMS_PALETTE[0].main, // V2는 Palette[0] (Blue)
        timestamp: Date.now(),
        imageData
      };

      state.updateNodeData(nodeId, {
        text: newText, // [SYNC] Legacy fallback
        versions: [...updatedVersions, newVersion],
        currentVersionId: newVerId
      });
    } else {
      // 결과가 없거나 분기가 불가능하면 해당 탭의 텍스트만 업데이트
      const updatedVersions = versions.map(v => 
        v.id === versionId ? { ...v, text: newText, ...(imageData && { imageData }) } : v
      );
      state.updateNodeData(nodeId, {
        text: newText, // [SYNC] Legacy fallback
        versions: updatedVersions,
        currentVersionId: versionId
      });
    }
  },
  deleteNode: (id) => {
    const state = get();
    const deletedNode = state.nodes.find(n => n.id === id);
    
    // 만약 turnGroup을 삭제하는 것이라면, 부모 프롬프트의 매칭된 버전도 삭제
    if (deletedNode && isTurnGroupNode(deletedNode)) {
      const color = deletedNode.data.versionColor;
      if (color) {
        const edge = state.edges.find(e => e.target === id);
        if (edge) {
          const parentPrompt = state.nodes.find(n => n.id === edge.source);
          if (parentPrompt && isPromptNode(parentPrompt)) {
            const pData = getPromptNodeData(parentPrompt.data);
            const updated = (pData.versions || []).filter(v => v.color !== color);
            state.updateNodeData(parentPrompt.id, { 
              versions: updated,
              currentVersionId: updated[0]?.id || 'v1'
            });
          }
        }
      }
    }

    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
    get().saveCurrentProject();
  },
  deleteNodes: (ids) => {
    const state = get();
    const idSet = new Set(ids);
    
    // 1. 삭제할 노드들로부터 영향을 받는 프롬프트 노드들의 업데이트 맵 생성 (Batching)
    const promptUpdates: Record<string, Partial<PromptNodeData>> = {};

    ids.forEach(id => {
      const deletedNode = state.nodes.find(n => n.id === id);
      if (deletedNode && isTurnGroupNode(deletedNode)) {
        const color = deletedNode.data.versionColor;
        if (color) {
          const edge = state.edges.find(e => e.target === id);
          if (edge) {
            const parentPrompt = state.nodes.find(n => n.id === edge.source);
            if (parentPrompt && isPromptNode(parentPrompt)) {
              const pData = getPromptNodeData(parentPrompt.data);
              const currentVersions = promptUpdates[parentPrompt.id]?.versions || pData.versions;
              const updated = currentVersions.filter(v => v.color !== color);
              promptUpdates[parentPrompt.id] = {
                versions: updated,
                currentVersionId: updated[0]?.id || 'v1'
              };
            }
          }
        }
      }
    });

    // 2. 한 번의 set 호출로 노드 필터링 및 데이터 업데이트 수행
    set({
      nodes: state.nodes
        .filter((n) => !idSet.has(n.id))
        .map((n) => (promptUpdates[n.id] ? { ...n, data: { ...n.data, ...promptUpdates[n.id] } } : n)),
      edges: state.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
    });
    
    get().saveCurrentProject();
  },
  deletePromptVersion: (nodeId, versionId) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !isPromptNode(node)) return;

    const pData = getPromptNodeData(node.data);
    const versions = pData.versions || [];
    if (versions.length <= 1) return;

    const versionToDelete = versions.find(v => v.id === versionId);
    if (!versionToDelete) return;

    const edgesToDelete = state.edges.filter(e =>
      e.source === nodeId &&
      ((e.data as any)?.color === versionToDelete.color || (!(e.data as any)?.color && versionToDelete.id === 'v1'))
    );

    const childNodeIds = edgesToDelete.map(e => e.target);
    const updatedVersions = versions.filter(v => v.id !== versionId);
    
    const newCurrentVersionId = pData.currentVersionId === versionId
      ? updatedVersions[updatedVersions.length - 1].id
      : pData.currentVersionId;

    if (childNodeIds.length > 0) {
      state.deleteNodes(childNodeIds);
    }

    set({
      nodes: get().nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, versions: updatedVersions, currentVersionId: newCurrentVersionId } } : n
      )
    });
    get().saveCurrentProject();
  },

  currentProjectId: null,
  projects: [],
  loadProjectsList: async () => {
    const projects = await getAllProjects();
    set({ projects: projects.sort((a, b) => b.updatedAt - a.updatedAt) });
  },
  createNewProject: async () => {
    const centralNode: AppNode = {
      id: `text-${Date.now()}`,
      type: 'sticky',
      position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 },
      data: { 
        text: '', // Required by StickyNodeData
        versions: [{
          id: 'v1',
          text: '',
          color: INITIAL_GRAY,
          timestamp: Date.now()
        }],
        currentVersionId: 'v1'
      },
    };

    const newProject: Project = {
      id: generateId(),
      name: `New Project ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [centralNode],
      edges: [],
    };
    await saveProject(newProject);
    set({
      currentProjectId: newProject.id,
      nodes: [centralNode],
      edges: [],
    });
    get().loadProjectsList();
  },
  loadProjectData: async (id) => {
    const project = await getProject(id);
    if (project) {
      set({
        currentProjectId: project.id,
        nodes: project.nodes,
        edges: project.edges,
      });
    }
  },
  saveCurrentProject: async () => {
    const { currentProjectId, nodes, edges } = get();
    if (currentProjectId) {
      const project = await getProject(currentProjectId);
      if (project) {
        // 저장 전 함수 속성 제거 (JSON 직렬화 불가 항목 제거)
        const serializableNodes = nodes.map((n) => {
          if (!isTurnGroupNode(n)) return n;
          const { thesis, antithesis, synthesis, support, ...rest } = n.data;
          // React Flow의 내부 속성 등이 섞일 수 있으므로 필요한 데이터만 추출하거나
          // 혹은 직렬화 방해 요소를 명확히 제거
          return { ...n, data: { thesis, antithesis, synthesis, support, ...rest } };
        });
        await saveProject({
          ...project,
          nodes: serializableNodes,
          edges,
        });
        get().loadProjectsList();
      }
    }
  },
  deleteProjectData: async (id) => {
    await deleteProject(id);
    if (get().currentProjectId === id) {
      set({ currentProjectId: null, nodes: [], edges: [] });
    }
    get().loadProjectsList();
  },

  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),
  rightPanelWidth: Number(localStorage.getItem('rightPanelWidth')) || 400,
  setRightPanelWidth: (width) => {
    set({ rightPanelWidth: width });
    localStorage.setItem('rightPanelWidth', width.toString());
  },
  selectedNodeId: null,
  selectedNodeIds: [],
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  toolMode: 'select' as 'select' | 'pan' | 'lasso',
  setToolMode: (mode) => set({ toolMode: mode }),

  autoExpertMode: true,
  setAutoExpertMode: (val) => set({ autoExpertMode: val }),
  selectedExpertIds: EXPERTS.map((e) => e.id),
  toggleExpertSelection: (id) =>
    set((state) => ({
      selectedExpertIds: state.selectedExpertIds.includes(id)
        ? state.selectedExpertIds.filter((eId) => eId !== id)
        : [...state.selectedExpertIds, id],
    })),
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
  currentMode: null,
  setCurrentMode: (mode) => set({ currentMode: mode }),
  generationTurn: 0,
  setGenerationTurn: (turn) => set({ generationTurn: turn }),

  // ─── 중앙 관리소: Re-generate 전용 액션 구현 ───
  createPromptAndRegenerate: async (sourceNodeId, prompt, imageData) => {
    const state = get();
    const sourceNode = state.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // 1. Prompt Node 생성 (임시 입력값을 노드화)
    const promptNodeId = `node-prompt-${generateId()}`;
    const newX = sourceNode.position.x + 950;
    const newY = sourceNode.position.y;

    state.addNode({
      id: promptNodeId,
      type: 'sticky',
      position: { x: newX, y: newY },
      data: { 
        text: '', // Required by StickyNodeData
        versions: [{
          id: 'v1',
          text: prompt,
          color: INITIAL_GRAY, // V1은 회색으로 시작
          timestamp: Date.now(),
          imageData
        }],
        currentVersionId: 'v1'
      },
      selected: true,
    } as AppNode);

    state.setSelectedNodeId(promptNodeId);

    state.onConnect({
      source: sourceNodeId,
      target: promptNodeId,
      sourceHandle: null,
      targetHandle: null,
      type: 'protocolEdge',
      data: { protocol: 'dialectic' }
    } as any);

    // 3. 딜레이 후 프롬프트 기반으로 실제 재-토론 발생 (UI가 먼저 렌더링될 시간 부여)
    setTimeout(() => {
      get().reGenerateFromPrompt(promptNodeId);
    }, 100);
  },

  reGenerateFromPrompt: async (promptNodeId: string) => {
    const state = get();
    const promptNode = state.nodes.find((n) => n.id === promptNodeId);
    if (!promptNode || !isPromptNode(promptNode)) return;

    const nodeData = getPromptNodeData(promptNode.data);
    const versions = nodeData.versions;
    const currentVersionId = nodeData.currentVersionId;
    const currentVer = versions.find(v => v.id === currentVersionId) || versions[0];
    
    // 현재 탭의 텍스트가 이미 결과물을 낸 텍스트와 다를 경우 분기 생성 여부 판단
    const existingEdges = state.edges.filter(e => e.source === promptNodeId && (e.data as any)?.color === currentVer.color);
    const hasExistingResult = existingEdges.length > 0;

    let targetVersion = currentVer;

    // 만약 이미 결과가 있는 상태에서 다시 'Generate'를 누르고, 남은 슬롯이 있다면 -> 새로운 분기 생성
    if (hasExistingResult && versions.length < 6) {
      const nextIndex = versions.length;
      const newVerId = `v-${generateId()}`;
      
      let updatedVersions = [...versions];
      // [상태 전칙] V1 -> V2 전환 시 V1 Red로 박제
      if (versions.length === 1 && versions[0].id === 'v1') {
        updatedVersions[0] = { ...updatedVersions[0], color: LEGACY_RED };
        
        // V1 관련 인프라 Red 전이
        state.edges.filter(e => e.source === promptNodeId && (!(e.data as any)?.color || (e.data as any)?.color === INITIAL_GRAY))
          .forEach(e => {
            set(s => ({ edges: s.edges.map(ed => ed.id === e.id ? { ...ed, data: { ...ed.data, color: LEGACY_RED } } : ed) }));
            set(s => ({ nodes: s.nodes.map(n => n.id === e.target ? { ...n, data: { ...n.data, versionColor: LEGACY_RED } } : n) }));
          });
      }

      const newVersion: PromptVersion = {
        id: newVerId,
        text: currentVer.text,
        color: GEMS_PALETTE[nextIndex - 1]?.main,
        timestamp: Date.now()
      };
      
      state.updateNodeData(promptNodeId, {
        versions: [...updatedVersions, newVersion],
        currentVersionId: newVerId
      });
      targetVersion = newVersion;
    }

    const incomingEdge = state.edges.find((e) => e.target === promptNodeId);
    const parentNode = incomingEdge ? state.nodes.find((n) => n.id === incomingEdge.source) : undefined;
    
    let isRootOrMemo = false;
    let prevFinalOutput = '';

    if (!incomingEdge) {
      isRootOrMemo = true;
    } else if (parentNode && !isTurnGroupNode(parentNode)) {
      isRootOrMemo = true;
    } else if (parentNode && isTurnGroupNode(parentNode)) {
      prevFinalOutput = parentNode.data.finalOutput ?? '';
    } else {
      return;
    }

    const turn = isRootOrMemo ? 1 : ((parentNode?.data as any)?.turn ?? 0) + 1;
    const promptText = targetVersion.text;
    const imageData = targetVersion.imageData;

    state.setIsGenerating(true);
    state.setRightPanelWidth(window.innerWidth * 0.5);
    state.setRightPanelOpen(true);
    
    const newGroupId = `node-group-regen-${generateId()}`;
    const versionColor = targetVersion.color || INITIAL_GRAY;

    // [BUG FIX] DOM 네이티브 포커싱 유지 및 기존 선택 해제
    state.setNodes(state.nodes.map(n => ({ ...n, selected: false })));

    // Ghost Node 즉시 생성
    state.addNode({
      id: newGroupId,
      type: 'turnGroup',
      position: { x: promptNode.position.x + 350, y: promptNode.position.y },
      selected: true,
      data: {
        turn,
        versionColor,
        loading: true,
        thesis: { expertId: '', role: 'thesis', shortContent: '', fullContent: '', keywords: [] },
        antithesis: { expertId: '', role: 'antithesis', shortContent: '', fullContent: '', keywords: [] },
        synthesis: { expertId: '', role: 'synthesis', shortContent: '', fullContent: '', keywords: [] },
        support: { expertId: '', role: 'support', shortContent: '', fullContent: '', keywords: [] },
      },
    } as any);

    // Edge 즉시 연결
    state.onConnect({
      source: promptNodeId,
      target: newGroupId,
      sourceHandle: null,
      targetHandle: null,
      data: { protocol: 'dialectic', color: versionColor }
    } as any);

    // [PLAN: Auto-Select New Node]
    state.setSelectedNodeId(newGroupId);

    try {
      if (isRootOrMemo) {
        await generateDiscussion(
          promptText,
          state.currentMode || 'A',
          state.selectedExpertIds,
          {
            onSquadSelected: (squad) => {
              state.updateNodeData(newGroupId, { ...squad });
            },
            onStreamChunk: (partial) => {
              state.updateNodeData(newGroupId, { ...partial });
            }
          },
          imageData
        ).then(fullResult => {
          state.updateNodeData(newGroupId, { ...fullResult, loading: false });
          state.setGenerationTurn(turn);
        });
      } else {
        await regenerateDiscussion(
          prevFinalOutput,
          promptText,
          state.currentMode,
          state.selectedExpertIds,
          {
            onSquadSelected: (squad) => {
              state.updateNodeData(newGroupId, { ...squad });
            },
            onStreamChunk: (partial) => {
              state.updateNodeData(newGroupId, { ...partial });
            }
          },
          imageData
        ).then(fullResult => {
          state.updateNodeData(newGroupId, { ...fullResult, loading: false });
          state.setGenerationTurn(turn);
        });
      }
    } catch (e) {
      console.error('Re-generate 실패:', e);
      state.deleteNode(newGroupId);
      alert('재생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      state.setIsGenerating(false);
    }
  },

  combineAndGenerateVCS: async (sourceIds: string[], customPrompt?: string, forcedVersionColor?: string) => {
    const state = get();
    if (sourceIds.length === 0) return;

    state.setIsGenerating(true);
    state.setRightPanelWidth(window.innerWidth * 0.5);
    state.setRightPanelOpen(true);

    // 1. 소스 노드들로부터 텍스트 추출 및 취합 (Aggregation Process)
    const aggregatedParts = sourceIds.map((id, index) => {
      const node = state.nodes.find(n => n.id === id);
      if (!node) return `Source ${index + 1}: [Unknown]`;
      
      let content = '';
      let typeLabel = '';
      
      if (isTurnGroupNode(node)) {
        content = node.data.finalOutput;
        typeLabel = 'VCS Result';
      } else if (isPromptNode(node)) {
        const pData = getPromptNodeData(node.data);
        content = pData.versions.find(v => v.id === pData.currentVersionId)?.text || '';
        typeLabel = 'Prompt';
      } else if (isStickyNode(node)) {
        content = node.data.fullText || node.data.text;
        typeLabel = 'Sticky Note';
      }
      
      return `[Source ${index + 1} - ${typeLabel}]\n${content}`;
    });

    const aggregatedPrompt = `[통합 안건 — 다중 노드 결합 결론 도출]\n\n${aggregatedParts.join('\n\n')}\n\n---\n[추가 지시사항]\n${customPrompt || '위 소스들을 종합하여 안건을 심층 분석하십시오. **반드시 첫 줄에 [[SQUAD]] 태그부터 시작하는 GEMS 프로토콜의 모든 출력 태그 규칙을 예외 없이 엄격하게 준수하여 토론을 진행해야 합니다.**'}`;

    // 2. 결과 노드(TurnGroupNode) 생성 위치 계산 (첫 번째 노드 기준 우측)
    const firstNode = state.nodes.find(n => n.id === sourceIds[0]);
    const spawnPos = firstNode 
      ? { x: firstNode.position.x + 650, y: firstNode.position.y }
      : { x: 500, y: 500 };

    const newGroupId = `node-group-combined-${generateId()}`;
    const versionColor = forcedVersionColor || INITIAL_GRAY;

    // [BUG FIX] DOM 네이티브 포커싱 및 기존 선택 해제
    state.setNodes(state.nodes.map(n => ({ ...n, selected: false })));

    // 3. TurnGroupNode 생성 (캔버스에는 중간 노드는 보이지 않음)
    state.addNode({
      id: newGroupId,
      type: 'turnGroup',
      position: spawnPos,
      selected: true,
      data: {
        turn: 1,
        versionColor,
        aggregatedPrompt, // 추출된 원본 텍스트 저장
        loading: true,
        thesis: { expertId: '', role: 'thesis', shortContent: '', fullContent: '', keywords: [] },
        antithesis: { expertId: '', role: 'antithesis', shortContent: '', fullContent: '', keywords: [] },
        synthesis: { expertId: '', role: 'synthesis', shortContent: '', fullContent: '', keywords: [] },
        support: { expertId: '', role: 'support', shortContent: '', fullContent: '', keywords: [] },
      },
    } as any);

    // 4. 모든 소스 노드와 새 노드 연결 (Multi-Edge)
    sourceIds.forEach(sourceId => {
      state.onConnect({
        source: sourceId,
        target: newGroupId,
        sourceHandle: null,
        targetHandle: null,
        data: { protocol: 'dialectic', color: versionColor }
      } as any);
    });

    // [PLAN: Auto-Select New Node]
    state.setSelectedNodeId(newGroupId);

    // 5. VCS 토론 실행 (Strict Single-Turn)
    // 단 한 번의 호출로 요약(aggregatedSummary)부터 결론까지 스트리밍합니다.
    try {
      await generateDiscussion(
        aggregatedPrompt,
        state.currentMode || 'A',
        state.selectedExpertIds,
        {
          onSquadSelected: (squad) => {
            state.updateNodeData(newGroupId, { ...squad });
          },
          onStreamChunk: (partial) => {
            state.updateNodeData(newGroupId, { ...partial });
          }
        }
      ).then(fullResult => {
        state.updateNodeData(newGroupId, { ...fullResult, loading: false });
      });
    } catch (e) {
      console.error('Combined VCS 실패:', e);
      state.deleteNode(newGroupId);
      alert('통합 토론 생성에 실패했습니다.');
    } finally {
      state.setIsGenerating(false);
    }
  },
}));
