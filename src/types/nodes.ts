import { Node } from '@xyflow/react';

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
}

export interface PromptVersion {
  id: string;
  text: string;
  color: string;
  timestamp: number;
}

export interface PromptNodeData extends Record<string, unknown> {
  versions: PromptVersion[];
  currentVersionId: string;
}

export type DiscussionType = 'thesis' | 'antithesis' | 'synthesis';

export interface DiscussionNodeData extends Record<string, unknown> {
  type: DiscussionType;
  expertId: string;
  content: string;
  turn: number;
}

// Helper types for type guards or casting
export type AllNodeData = StickyNodeData | TurnGroupNodeData | PromptNodeData | DiscussionNodeData;
export type AppNode = Node<AllNodeData>;

export function isStickyNode(node: AppNode): node is Node<StickyNodeData> {
  return node.type === 'sticky';
}

export function isTurnGroupNode(node: AppNode): node is Node<TurnGroupNodeData> {
  return node.type === 'turnGroup';
}

export function isPromptNode(node: AppNode): node is Node<PromptNodeData> {
  return node.type === 'promptNode';
}

export function isDiscussionNode(node: AppNode): node is Node<DiscussionNodeData> {
  return node.type === 'discussion';
}
