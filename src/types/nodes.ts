import { Node } from '@xyflow/react';
import { SynapseNodeData } from './synapse';

export interface ExpertTurnData {
  expertId: string;
  role: 'thesis' | 'antithesis' | 'synthesis' | 'support';
  keywords?: string[];
  shortContent: string;
  fullContent: string;
}

export interface MetacognitiveDefinition {
  selectedMode: string;
  projectDefinition: string;
  activeSquadReason: string;
}

export interface TransparencyReport {
  selfHealingLog: string;
  truthfulnessCheck: string;
  realImpact: string;
  nextActionSuggestion: string;
}

export interface StickyNodeData extends Record<string, unknown> {
  text: string;
  fullText?: string;
  imageUrl?: string;
  isLocked?: boolean;
  versions?: PromptVersion[]; // [MERGE NEW]
  currentVersionId?: string;  // [MERGE NEW]
}

export interface TurnGroupNodeData extends Record<string, unknown> {
  turn: number;
  metacognitiveDefinition: MetacognitiveDefinition;
  workflowSimulationLog: string;
  thesis: ExpertTurnData;
  antithesis: ExpertTurnData;
  synthesis: ExpertTurnData;
  support: ExpertTurnData;
  shortFinalOutput: string;
  finalOutput: string;
  transparencyReport: TransparencyReport;
  aggregatedPrompt?: string; // [NEW] 다중 선택 시 취합된 통합 안건 (Raw)
  aggregatedSummary?: string; // [NEW] 취합본 요약 (AI 생성)
  aggregatedKeywords?: string[]; // [NEW] 취합본 키워드 (AI 생성)
}

export interface PromptVersion {
  id: string;
  text: string;
  color: string;
  timestamp: number;
}

export type PromptNodeData = StickyNodeData; // Alias for backward compatibility if needed

export type DiscussionType = 'thesis' | 'antithesis' | 'synthesis';

export interface DiscussionNodeData extends Record<string, unknown> {
  type: DiscussionType;
  expertId: string;
  content: string;
  turn: number;
}

// Helper types for type guards or casting
export type AllNodeData = StickyNodeData | TurnGroupNodeData | PromptNodeData | DiscussionNodeData | SynapseNodeData;
export type AppNode = Node<AllNodeData>;

export function isStickyNode(node: AppNode): node is Node<StickyNodeData> {
  return node.type === 'sticky';
}

export function isTurnGroupNode(node: AppNode): node is Node<TurnGroupNodeData> {
  return node.type === 'turnGroup';
}

export function isPromptNode(node: AppNode): node is Node<PromptNodeData> {
  return node.type === 'promptNode' || node.type === 'sticky';
}

export function isDiscussionNode(node: AppNode): node is Node<DiscussionNodeData> {
  return node.type === 'discussion';
}

export function isSynapseNode(node: AppNode): node is Node<SynapseNodeData> {
  return node.type === 'synapseNode';
}

/**
 * 프롬프트 노드의 데이터를 안전하게 정규화하여 반환하는 헬퍼 함수
 * 레거시 데이터(prompt 필드) 형태를 최신 버전 구조로 자동 변환합니다.
 */
export function getPromptNodeData(data: AllNodeData): PromptNodeData {
  const pData = data as any;
  const versions = (pData.versions && Array.isArray(pData.versions) && pData.versions.length > 0)
    ? pData.versions as PromptVersion[]
    : [{ 
        id: 'v1', 
        text: pData.text || pData.prompt || '', 
        color: undefined, 
        timestamp: Date.now() 
      } as PromptVersion];

  return {
    ...pData,
    versions,
    currentVersionId: pData.currentVersionId || versions[0].id
  };
}
