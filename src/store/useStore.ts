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
import { regenerateDiscussion } from '../lib/gemini';

export type AppMode = 'A' | 'B' | 'C' | null;

interface AppState {
  // React Flow State
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNodeData: (id: string, data: any) => void;

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
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  toolMode: 'select' | 'pan';
  setToolMode: (mode: 'select' | 'pan') => void;

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
  createPromptAndRegenerate: (sourceNodeId: string, prompt: string) => Promise<void>;
  reGenerateFromPrompt: (promptNodeId: string) => Promise<void>;
  deleteNode: (id: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
    get().saveCurrentProject();
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    get().saveCurrentProject();
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
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
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
    get().saveCurrentProject();
  },
  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
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
    const centralNode: Node = {
      id: `text-${Date.now()}`,
      type: 'sticky',
      position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 },
      data: { text: '' },
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
          if (n.type !== 'turnGroup') return n;
          const { onRegenerate, onSelectExpert, ...safeData } = n.data as any;
          return { ...n, data: safeData };
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
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  toolMode: 'select',
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
  createPromptAndRegenerate: async (sourceNodeId, prompt) => {
    const state = get();
    const sourceNode = state.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) return;

    // 1. Prompt Node 생성 (임시 입력값을 노드화)
    const promptNodeId = `node-prompt-${Date.now()}`;
    const newX = sourceNode.position.x + 950;
    const newY = sourceNode.position.y;

    state.addNode({
      id: promptNodeId,
      type: 'promptNode',
      position: { x: newX, y: newY },
      data: { prompt }
    } as Node);

    state.onConnect({
      source: sourceNodeId,
      target: promptNodeId,
      sourceHandle: null,
      targetHandle: null,
    });

    // 3. 딜레이 후 프롬프트 기반으로 실제 재-토론 발생 (UI가 먼저 렌더링될 시간 부여)
    setTimeout(() => {
      get().reGenerateFromPrompt(promptNodeId);
    }, 100);
  },

  reGenerateFromPrompt: async (promptNodeId: string) => {
    const state = get();
    const promptNode = state.nodes.find((n) => n.id === promptNodeId);
    if (!promptNode) return;

    // 선행 그룹 노드(부모) 탐색
    const incomingEdge = state.edges.find((e) => e.target === promptNodeId);
    if (!incomingEdge) return;
    const parentNode = state.nodes.find((n) => n.id === incomingEdge.source);
    if (!parentNode || parentNode.type !== 'turnGroup') return;

    const prevFinalOutput = (parentNode.data as any).finalOutput ?? '';
    const turn = ((parentNode.data as any).turn ?? 0) + 1;
    const promptText = (promptNode.data as any).prompt ?? '';

    state.setIsGenerating(true);
    try {
      const reResult = await regenerateDiscussion(
        prevFinalOutput,
        promptText,
        state.selectedExpertIds
      );

      const newGroupId = `node-group-regen-${Date.now()}`;
      const newX = promptNode.position.x + 350; // 프롬프트 노드 우측에 생성
      const newY = promptNode.position.y;

      state.addNode({
        id: newGroupId,
        type: 'turnGroup',
        position: { x: newX, y: newY },
        data: {
          turn,
          metacognitiveDefinition: reResult.metacognitiveDefinition,
          workflowSimulationLog: reResult.workflowSimulationLog,
          thesis: reResult.thesis,
          antithesis: reResult.antithesis,
          synthesis: reResult.synthesis,
          support: reResult.support,
          shortFinalOutput: reResult.shortFinalOutput,
          finalOutput: reResult.finalOutput,
          transparencyReport: reResult.transparencyReport,
        },
      } as Node);

      state.onConnect({
        source: promptNodeId,
        target: newGroupId,
        sourceHandle: null,
        targetHandle: null,
      });
    } catch (e) {
      console.error('Re-generate 실패:', e);
      alert('재생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      state.setIsGenerating(false);
    }
  },
}));
