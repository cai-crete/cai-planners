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
import { regenerateDiscussion, generateDiscussion, analyzePromptMode } from '../lib/gemini';
import { RANKED_SQUAD_DATA } from '../lib/synergyData';
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
  isCanvasOpen: boolean;
  setCanvasOpen: (isOpen: boolean) => void;
  toggleCanvas: () => void;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  setLeftPanelOpen: (isOpen: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  lastActiveNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setLastActiveNodeId: (id: string | null) => void;
  
  firstPromptText: string;
  syncFirstPromptText: (text: string) => void;
  toolMode: 'select' | 'pan' | 'lasso';
  setToolMode: (mode: 'select' | 'pan' | 'lasso') => void;

  // Expert & Generation State
  autoExpertMode: boolean;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  getChatHistory: (leafNodeId: string) => AppNode[];
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
  duplicateCurrentProject: () => Promise<void>;

  // 기획자 아코디언 브릿지
  activeExpertRole: string | null; // '트리거되어 열릴' 엑스퍼트 role e.g. 'thesis'
  setActiveExpertRole: (role: string | null) => void;

  // 스니펫
  snippets: { id: string; title: string; content: string; timestamp: number }[];
  addSnippet: (content: string, title?: string) => void;
  deleteSnippet: (id: string) => void;
}

export const generateId = () => Math.random().toString(36).substring(2, 9);

// 삭제: spawnExplorers 함수는 독립적인 전문가 노드 생성 버그로 인해 제거됨.

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
      sourceHandle: connection.sourceHandle || 'bottom',
      targetHandle: connection.targetHandle || 'top',
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
      // 가장 최근 노드(보통 마지막 노드)를 자동으로 선택하여 화면에 즉시 표시
      const lastNodeId = project.nodes.length > 0 
        ? project.nodes[project.nodes.length - 1].id 
        : null;

      set({
        currentProjectId: project.id,
        nodes: project.nodes,
        edges: project.edges,
        selectedNodeId: lastNodeId,
        isRightPanelOpen: true, // 세션 로드 시 패널을 열어 대화가 보이도록 함
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
  duplicateCurrentProject: async () => {
    const { currentProjectId, nodes, edges } = get();
    if (!currentProjectId) return;
    const project = await getProject(currentProjectId);
    if (!project) return;

    const newProject: Project = {
      ...project,
      id: generateId(),
      name: `${project.name} (원본 기록)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [...nodes],
      edges: [...edges],
    };

    await saveProject(newProject);
    await get().loadProjectsList();
  },
  deleteProjectData: async (id) => {
    await deleteProject(id);
    const wasCurrentProject = get().currentProjectId === id;
    if (wasCurrentProject) {
      set({ currentProjectId: null, nodes: [], edges: [] });
    }
    await get().loadProjectsList();
    // 현재 프로젝트를 삭제했을 경우, 남은 프로젝트로 자동 전환
    if (wasCurrentProject) {
      const remaining = useStore.getState().projects;
      if (remaining.length > 0) {
        await get().loadProjectData(remaining[0].id);
      } else {
        await get().createNewProject();
      }
    }
  },

  isCanvasOpen: false, // 기본적으로 닫혀있음
  setCanvasOpen: (isOpen) => set({ isCanvasOpen: isOpen }),
  toggleCanvas: () => set((state) => ({ isCanvasOpen: !state.isCanvasOpen })),
  isLeftPanelOpen: true, // 첫 시작화면에서는 열려 있음
  isRightPanelOpen: true,
  setLeftPanelOpen: (isOpen) => set({ isLeftPanelOpen: isOpen }),
  toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),
  rightPanelWidth: Number(localStorage.getItem('rightPanelWidth')) || window.innerWidth * 0.55,
  setRightPanelWidth: (width) => {
    set({ rightPanelWidth: width });
    localStorage.setItem('rightPanelWidth', width.toString());
  },
  selectedNodeId: null,
  selectedNodeIds: [],
  lastActiveNodeId: null,
  firstPromptText: '',
  syncFirstPromptText: (text) => set({ firstPromptText: text }),
  setSelectedNodeId: (id) => set((state) => ({ 
    selectedNodeId: id,
    lastActiveNodeId: id !== null ? id : state.lastActiveNodeId
  })),
  setLastActiveNodeId: (id) => set({ lastActiveNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  toolMode: 'select' as 'select' | 'pan' | 'lasso',
  setToolMode: (mode) => set({ toolMode: mode }),

  activeExpertRole: null,
  setActiveExpertRole: (role) => set({ activeExpertRole: role }),

  snippets: [],
  addSnippet: (content, title) => set((state) => ({
    snippets: [
      ...state.snippets,
      {
        id: generateId(),
        title: title || `스니펫 ${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        content,
        timestamp: Date.now(),
      }
    ]
  })),
  deleteSnippet: (id) => set((state) => ({
    snippets: state.snippets.filter(s => s.id !== id)
  })),

  autoExpertMode: true,
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
  
  getChatHistory: (leafNodeId: string) => {
    const state = get();
    const history: AppNode[] = [];
    let currentId: string | null = leafNodeId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = state.nodes.find(n => n.id === currentId);
      if (node) {
        history.unshift(node);
      }
      const incomingEdge = state.edges.find(e => e.target === currentId);
      currentId = incomingEdge ? incomingEdge.source : null;
    }
    return history;
  },
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
    const newX = sourceNode.position.x;
    const newY = sourceNode.position.y + 600;

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
    state.setRightPanelWidth(window.innerWidth * 0.6);
    state.setRightPanelOpen(true);

    // 1. 모드 자동 판별 (지능형 고립 연산)
    const detectedMode = await analyzePromptMode(promptText, ""); // 히스토리는 필요 시 추가 확장
    state.setCurrentMode(detectedMode);
    
    const newGroupId = `node-group-regen-${generateId()}`;
    const versionColor = targetVersion.color || INITIAL_GRAY;

    // [BUG FIX] DOM 네이티브 포커싱 유지 및 기존 선택 해제
    state.setNodes(state.nodes.map(n => ({ ...n, selected: false })));

    // 2. 전략적 전문가 선발 (Group A: 최적, Group B/C: 시너지 Top 5 중 무작위)
    const rankedData = RANKED_SQUAD_DATA[detectedMode];
    
    // Group A: Rank 1
    const squadA = rankedData[0];
    
    // Group B, C: Rank 2~5 중 무작위 2팀
    const top5Remaining = rankedData.slice(1, 5).sort(() => Math.random() - 0.5);
    const squadB = top5Remaining[0];
    const squadC = top5Remaining[1];

    const squads = [squadA, squadB, squadC];
    const groupIds = ['A', 'B', 'C'];

    const parallelResults = groupIds.map((gid, idx) => ({
      groupId: gid,
      squadIds: squads[idx].ids,
      synergyScore: squads[idx].score,
      status: 'loading' as const,
      mode: detectedMode,
      data: {}
    }));

    // Ghost Node 즉시 생성
    state.addNode({
      id: newGroupId,
      type: 'turnGroup',
      position: { x: promptNode.position.x, y: promptNode.position.y + 700 }, // 약간 더 간격 벌림
      selected: true,
      data: {
        turn,
        versionColor,
        isParallel: true,
        parallelResults,
        loading: true,
        // Root fallback values
        thesis: { expertId: squads[0].ids[0], role: 'thesis', shortContent: '', fullContent: '', keywords: [] },
        antithesis: { expertId: squads[0].ids[1], role: 'antithesis', shortContent: '', fullContent: '', keywords: [] },
        synthesis: { expertId: squads[0].ids[2], role: 'synthesis', shortContent: '', fullContent: '', keywords: [] },
        support: { expertId: squads[0].ids[3], role: 'support', shortContent: '', fullContent: '', keywords: [] },
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

    // 상태 업데이트 헬퍼
    const updateParallelGroup = (index: number, partialData: any) => {
      set((s) => ({
        nodes: s.nodes.map(n => {
          if (n.id === newGroupId && isTurnGroupNode(n)) {
            const newParallel = [...(n.data.parallelResults || [])];
            newParallel[index] = { ...newParallel[index], data: { ...newParallel[index].data, ...partialData } };
            return { ...n, data: { ...n.data, parallelResults: newParallel } };
          }
          return n;
        })
      }));
    };

    const finishParallelGroup = (index: number, finalResult?: any) => {
      set((s) => ({
        nodes: s.nodes.map(n => {
          if (n.id === newGroupId && isTurnGroupNode(n)) {
             const newParallel = [...(n.data.parallelResults || [])];
             newParallel[index] = { 
               ...newParallel[index], 
               status: finalResult ? 'complete' : 'error',
               ...(finalResult ? { data: finalResult } : {})
             };
             const allComplete = newParallel.every(p => p.status === 'complete' || p.status === 'error');
             return { ...n, data: { ...n.data, parallelResults: newParallel, loading: !allComplete } };
          }
          return n;
        })
      }));
    };

    try {
      await Promise.all(groupIds.map(async (gid, index) => {
        const currentSquad = squads[index];
        const squadIds = currentSquad.ids;
        try {
          if (isRootOrMemo) {
            const res = await generateDiscussion(promptText, detectedMode, squadIds, {
              onSquadSelected: (squad) => updateParallelGroup(index, { ...squad }),
              onStreamChunk: (partial) => updateParallelGroup(index, partial)
            }, imageData);
            finishParallelGroup(index, res);
          } else {
            const res = await regenerateDiscussion(prevFinalOutput, promptText, detectedMode, squadIds, {
              onSquadSelected: (squad) => updateParallelGroup(index, { ...squad }),
              onStreamChunk: (partial) => updateParallelGroup(index, partial)
            }, imageData);
            finishParallelGroup(index, res);
          }
        } catch (e) {
          console.error(`Group ${gid} Error:`, e);
          finishParallelGroup(index); // Mark error
        }
      }));
      state.setGenerationTurn(turn);
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

    // 1. 빈 내용의 노드는 무시하도록 사전에 필터링 (validSourceIds 추출)
    const validSourceIds = sourceIds.filter(id => {
      const node = state.nodes.find(n => n.id === id);
      if (!node) return false;
      let content = '';
      if (isTurnGroupNode(node)) {
        content = node.data.finalOutput || '';
      } else if (isPromptNode(node)) {
        const pData = getPromptNodeData(node.data);
        content = pData.versions.find(v => v.id === pData.currentVersionId)?.text || '';
      } else if (isStickyNode(node)) {
        content = node.data.fullText || node.data.text || '';
      }
      return content.trim().length > 0;
    });

    if (validSourceIds.length === 0) {
      state.setIsGenerating(false);
      state.setRightPanelOpen(false);
      return;
    }

    // 1. 소스 노드들로부터 텍스트 추출 및 취합 (Aggregation Process)
    const aggregatedParts = validSourceIds.map((id, index) => {
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

    // 2. 결과 노드(TurnGroupNode) 생성 위치 계산 (첫 번째 유효한 노드 기준 우측)
    const firstNode = state.nodes.find(n => n.id === validSourceIds[0]);
    const spawnPos = firstNode 
      ? { x: firstNode.position.x, y: firstNode.position.y + 600 }
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

    // 4. 유효한 소스 노드들과 새 노드 연결 (Multi-Edge)
    validSourceIds.forEach(sourceId => {
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
        EXPERTS.map(e => e.id),
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
