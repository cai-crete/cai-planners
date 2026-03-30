import { Node } from '@xyflow/react';

export type SynapsePhase = 'germination' | 'expansion' | 'convergence' | 'extraction';

/** 
 * Phase 1: 최초 발아 (Seed Germination) 
 * 원칙 1(원자성)에 의거한 독립적 기획 객체
 */
export interface RootSeedData {
  id: string;
  coreIntention: string; // 본질적 의도
  context: string[];     // 도출된 현실적 제약 조건
  subBranches: string[]; // 파생된 핵심 분기 포인트
  timestamp: number;
}

/** 
 * Phase 2: 인과적 확장 (Causal Expansion) 
 */
export interface DerivedSeedData {
  id: string;
  parentId: string;      // 부모 노드 ID
  derivedConcept: string; // 파생된 단일 명제
  logicChain: string;    // 도달한 논리적 근거
  timestamp: number;
}

/** 
 * Phase 3 & 4: 융합 및 추출 (Convergence & Extraction) 
 */
export interface SynthesizedSeedData {
  id: string;
  sourceIds: string[];   // 융합된 소스 노드 ID들
  synthesizedInsight: string; // 창발적 핵심 명제
  valueProposition: string;   // 비즈니스적 가치
  finalOutput?: string;   // Phase 4 최종 산출물 (마크다운)
  targetFormat?: string;  // 사용자가 요청한 포맷
  timestamp: number;
}

export type SynapseNodeData = {
  phase: SynapsePhase;
  loading: boolean;
  versionColor?: string; // GEMS_PALETTE 또는 LEGACY_RED/INITIAL_GRAY
  error?: string;
  data: RootSeedData | DerivedSeedData | SynthesizedSeedData;
};

export type SynapseNode = Node<SynapseNodeData, 'synapseNode'>;
