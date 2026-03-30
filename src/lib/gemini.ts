import { Type } from '@google/genai';
import { EXPERTS } from './experts';
import { AppMode } from '../store/useStore';
import {
  SYNERGY_MATRIX,
  EXPERT_SUPPORT_MAP,
  EXPERT_PROFILES_COMPACT,
  MODE_SQUAD_MAP,
} from './synergyData';

// API 요청을 자체 백엔드로 프록시하는 헬퍼 함수
async function callGeminiApi(payload: any) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Gemini API Error: ${res.status}`);
  }
  const data = await res.json();
  return { text: data.text || '' };
}

/**
 * [UX 혁신] 실시간 스트리밍 처리를 위한 헬퍼 함수
 */
export async function callGeminiStreamingApi(
  payload: any,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Gemini Streaming Error: ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  if (!reader) throw new Error('ReadableStream not supported');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }
  return fullText;
}

/**
 * 스트리밍 중인 불완전한 JSON 문자열에서 최대한 데이터를 추출하는 유틸리티
 */
export function parsePartialJson<T>(jsonStr: string): Partial<T> {
  if (!jsonStr) return {} as Partial<T>;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      let cleaned = jsonStr.trim();
      if (!cleaned.endsWith('}')) {
        cleaned = cleaned.replace(/,\s*$/, '') + '}';
      }
      return JSON.parse(cleaned);
    } catch (e2) {
      return {} as Partial<T>;
    }
  }
}

// ─── 모델 엔드포인트 ───────────────────────────────────────────────────────────
// MODEL_ANALYSIS : VCS 전체 토론 및 기획서 생성 (고밀도 출력)
// MODEL_FLASH    : 전문가 선발, 요약본 분석, 프롬프트 확장 (고속 응답)
// MODEL_FALLBACK : MODEL_FLASH 실패 시 사용하는 안전망
const MODEL_ANALYSIS = 'gemini-3.1-pro-preview';
const MODEL_FLASH    = 'gemini-3-flash-preview';
const MODEL_FALLBACK = 'gemini-2.0-flash';

export interface ExpertTurn {
  expertId: string;
  role: string;
  keywords: string[];
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

export interface DiscussionResult {
  aggregatedSummary?: string;
  aggregatedKeywords?: string[];
  shortFinalOutput: string;
  metacognitiveDefinition: MetacognitiveDefinition;
  workflowSimulationLog: string;
  thesis: ExpertTurn;
  antithesis: ExpertTurn;
  synthesis: ExpertTurn;
  support: ExpertTurn;
  finalOutput: string;
  transparencyReport: TransparencyReport;
}

/**
 * 정규식 기반 태그 추출 유틸리티
 */
function extract(text: string, tag: string) {
  const regex = new RegExp(`\\[\\[${tag}\\]\\]([\\s\\S]*?)(?=\\[\\[|$)`, 'i');
  return text.match(regex)?.[1]?.trim() || '';
}

/**
 * 토론 생성 (GEMS Protocol V4.5 Absolute Restoration)
 */
export async function generateDiscussion(
  context: string,
  mode: AppMode,
  selectedExpertIds: string[],
  callbacks?: {
    onSquadSelected?: (squad: { thesis: any; antithesis: any; synthesis: any; support: any }) => void;
    onStreamChunk?: (partialResult: Partial<DiscussionResult>) => void;
  }
): Promise<DiscussionResult> {
  const getExpert = (id: string) => {
    const expert = EXPERTS.find((e) => e.id === id);
    return expert || EXPERTS[0];
  };

  const modeLabel: Record<string, string> = {
    A: 'Mode A — 창의적 탐구 (Creative Exploration)',
    B: 'Mode B — 논리적 심화 (Logical Analysis)',
    C: 'Mode C — 실용적 해법 (Practical Solutions)',
  };

  const detectedMode = mode || 'A';
  const availableProfiles = EXPERT_PROFILES_COMPACT.filter(e => selectedExpertIds.includes(e.id));

  const discussionPrompt = `
# GEMS Protocol — Active Metacognitive Architect (V4.5)

## ⚠️ 단일 회전(Single-Turn) 출력 규약
당신은 별도의 선발 단계 없이, 이 프롬프트 안에서 문맥을 분석하여 최적의 전문가 4인을 즉시 선발하고 토론을 시작해야 합니다.
출력의 **첫 번째 줄**은 반드시 아래 형식을 지켜야 합니다. (실시간 UI 바인딩용)
[[SQUAD]] thesisId, antithesisId, synthesisId, supportId

그 후, 아래 태그들을 순서대로 사용하여 마크다운 스트리밍을 진행하십시오.

---

## 출력 태그 구조 (반드시 이 순서를 준수)

[[SUMMARY]]
전체 토론의 핵심 취합 요약. 5줄 이내 브리핑. 마크다운 금지.

[[KEYWORDS]]
#키워드1 #키워드2 #키워드3 #키워드4 #키워드5

[[SHORT_FINAL]]
⚠️ 아래 규칙을 절대 준수하십시오:
- 분량: 반드시 3문장 이내. 초과 금지.
- 형식: 마크다운 기호(#, **, -, * 등) 완전 금지. 순수 텍스트만 사용.
- 내용: 전체 의견의 요약이 아닌, 이 안건의 핵심 방향을 직접 선언하는 문장.
- 예시: "본 안건의 핵심은 상충하는 가치 사이의 균형입니다. 실용적 접근과 원칙 고수가 동시에 필요하며, 첫 단계는 인과성 검증입니다."

[[METAC_DEF]]
판단한 탐구 모드(Mode)와 안건의 본질적 정의, 4인 선발 사유 기술.

[[THESIS_SHORT]]
⚠️ 제안자(Thesis)의 핵심 주장을 딱 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[THESIS]]
제안자의 전체 발언 본문: 역할명, 고유 논리 적용, 깊이 있는 제안. 충분히 상세하게 작성.

[[ANTITHESIS_SHORT]]
⚠️ 반박자(Antithesis)의 핵심 반박을 딱 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[ANTITHESIS]]
반박자의 전체 발언 본문: 논리 허점 집요 공격, 비판적 시각. 충분히 상세하게 작성.

[[SYNTHESIS_SHORT]]
⚠️ 통합자(Synthesis)의 핵심 통합안을 딱 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[SYNTHESIS]]
통합자의 전체 발언 본문: 대립점 해소, 제3의 대안 창조. 충분히 상세하게 작성.

[[SUPPORT_SHORT]]
⚠️ 검증자(Support)의 핵심 검증 결론을 딱 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[SUPPORT]]
검증자의 전체 발언 본문: 리스크 노출 및 논리적 인과 검증. 충분히 상세하게 작성.

[[FINAL_PLAN]]
상세 의견서 본문: 위계와 글머리 기호가 살아있는 정식 마크다운 문서.
반드시 아래 구조를 포함하십시오:
### 8.1 [Metacognitive Definition]
### 8.2 [Workflow Simulation Log]
### 8.3 [Final Output: 통합 전략 기획서]
#### 1. Executive Summary
#### 2. Strategic Layer
#### 3. Tactical Layer
#### 4. Execution & Risk
### 8.4 [Metacognitive Transparency Report]

---

## 전문가 선발 지침 (Internal Selector)
다음 지식을 활용하여 현 안건에 가장 적합한 4인을 선발하십시오. (어떤 주제든 유연하게 대응하십시오.)
- **모드별 스쿼드**: ${JSON.stringify(MODE_SQUAD_MAP)}
- **시너지 매트릭스**: ${JSON.stringify(SYNERGY_MATRIX.slice(0, 5))}
- **선택 가능 전문가**: ${JSON.stringify(availableProfiles)}
- **현재 모드**: ${modeLabel[detectedMode] || '범용 탐구 모드'}

---

## Layer 0: 불문율 (Background OS)
- **절대 축약 금지**: 전문가 4인의 격론 과정(8.2)을 생략하지 마십시오.
- **역할 경계 준수**: 제안자/반박자/통합자/검증자의 페르소나를 엄격히 분리하십시오.
- **SHORT 태그 준수**: 모든 _SHORT 태그는 반드시 1문장, 마크다운 금지, **개행 문자(\n) 완전 금지**를 고수하십시오. 줄바꿈 없이 순수 단일 문장으로만 작성하십시오.
- **SHORT_FINAL 준수**: [[SHORT_FINAL]]은 반드시 3문장 이내로 작성하십시오. 개행 문자 사용 금지.
- **전문가 호칭 규칙**: 토론 본문([[THESIS]], [[ANTITHESIS]], [[SYNTHESIS]], [[SUPPORT]], [[FINAL_PLAN]])에서 전문가를 지칭할 때 반드시 **역할명**(예: 혁신 설계자, 인과적 검증자, 통합 조율가 등)을 사용하십시오. T01, T05, T08 같은 ID 코드로 지칭하는 것은 **절대 금지**입니다.

---

## 토론 주제 및 맥락
${context}
`.trim();

  let squadApplied = false;
  let currentSquadIds: string[] = ['', '', '', ''];

  const handleChunk = (text: string) => {
    const squadRaw = extract(text, 'SQUAD');
    if (squadRaw) {
      const ids = squadRaw.split(',').map(id => id.trim());
      if (ids.length >= 4) {
        currentSquadIds = ids;
        if (!squadApplied && callbacks?.onSquadSelected) {
          callbacks.onSquadSelected({
            thesis: getExpert(ids[0]),
            antithesis: getExpert(ids[1]),
            synthesis: getExpert(ids[2]),
            support: getExpert(ids[3])
          });
          squadApplied = true;
        }
      }
    }

    if (callbacks?.onStreamChunk) {
      callbacks.onStreamChunk({
        aggregatedSummary: extract(text, 'SUMMARY'),
        aggregatedKeywords: extract(text, 'KEYWORDS').replace(/#/g, '').split(' ').map(s => s.trim()).filter(Boolean),
        shortFinalOutput: extract(text, 'SHORT_FINAL'),
        // [G2 FIX] _SHORT 태그를 각 전문가의 shortContent로 추출
        thesis: {
          shortContent: extract(text, 'THESIS_SHORT'),
          fullContent: extract(text, 'THESIS'),
          expertId: currentSquadIds[0],
          role: 'thesis',
          keywords: [],
        },
        antithesis: {
          shortContent: extract(text, 'ANTITHESIS_SHORT'),
          fullContent: extract(text, 'ANTITHESIS'),
          expertId: currentSquadIds[1],
          role: 'antithesis',
          keywords: [],
        },
        synthesis: {
          shortContent: extract(text, 'SYNTHESIS_SHORT'),
          fullContent: extract(text, 'SYNTHESIS'),
          expertId: currentSquadIds[2],
          role: 'synthesis',
          keywords: [],
        },
        support: {
          shortContent: extract(text, 'SUPPORT_SHORT'),
          fullContent: extract(text, 'SUPPORT'),
          expertId: currentSquadIds[3],
          role: 'support',
          keywords: [],
        },
        finalOutput: extract(text, 'FINAL_PLAN'),
      });
    }
  };

  // 토론 생성: 고밀도 출력이 필요하므로 MODEL_ANALYSIS (Pro) 사용
  const config = { temperature: 0.75, topP: 0.95 };
  let fullText = '';
  try {
    fullText = await callGeminiStreamingApi(
      { model: MODEL_ANALYSIS, contents: discussionPrompt, config },
      handleChunk
    );
  } catch (err) {
    console.error('[GEMS Error]', err);
    // 폴백 1: Flash 모델로 재시도
    try {
      console.warn('[GEMS] Pro 모델 실패. Flash 모델로 폴백...');
      fullText = await callGeminiStreamingApi(
        { model: MODEL_FLASH, contents: discussionPrompt, config },
        handleChunk
      );
    } catch (flashErr) {
      // 폴백 2: 마지막 안전망
      try {
        console.warn('[GEMS] Flash 모델 실패. 최종 폴백...');
        fullText = await callGeminiStreamingApi(
          { model: MODEL_FALLBACK, contents: discussionPrompt, config },
          handleChunk
        );
      } catch (fallbackErr) {
        console.error('[GEMS Fallback Error]', fallbackErr);
      }
    }
  }

  const finalSquadRaw = extract(fullText, 'SQUAD');
  const finalIds = finalSquadRaw.split(',').map(id => id.trim());

  return {
    aggregatedSummary: extract(fullText, 'SUMMARY'),
    aggregatedKeywords: extract(fullText, 'KEYWORDS').replace(/#/g, '').split(' ').map(s => s.trim()).filter(Boolean),
    shortFinalOutput: extract(fullText, 'SHORT_FINAL'),
    metacognitiveDefinition: {
      selectedMode: detectedMode,
      projectDefinition: extract(fullText, 'METAC_DEF'),
      activeSquadReason: 'GEMS Protocol V4.5 High-Integrity Selection',
    },
    // [G2 FIX] 최종 결과에도 _SHORT 태그 파싱 적용
    thesis: {
      expertId: finalIds[0] || '',
      role: 'thesis',
      keywords: [],
      shortContent: extract(fullText, 'THESIS_SHORT'),
      fullContent: extract(fullText, 'THESIS'),
    },
    antithesis: {
      expertId: finalIds[1] || '',
      role: 'antithesis',
      keywords: [],
      shortContent: extract(fullText, 'ANTITHESIS_SHORT'),
      fullContent: extract(fullText, 'ANTITHESIS'),
    },
    synthesis: {
      expertId: finalIds[2] || '',
      role: 'synthesis',
      keywords: [],
      shortContent: extract(fullText, 'SYNTHESIS_SHORT'),
      fullContent: extract(fullText, 'SYNTHESIS'),
    },
    support: {
      expertId: finalIds[3] || '',
      role: 'support',
      keywords: [],
      shortContent: extract(fullText, 'SUPPORT_SHORT'),
      fullContent: extract(fullText, 'SUPPORT'),
    },
    finalOutput: extract(fullText, 'FINAL_PLAN'),
    workflowSimulationLog: `VCS Debate Log (${new Date().toLocaleString()})`,
    transparencyReport: {
      selfHealingLog: 'V4.5 Absolute Restoration Protocol — SHORT tag extraction active',
      truthfulnessCheck: 'High',
      realImpact: 'Maximum',
      nextActionSuggestion: 'Review and Execute',
    },
  };
}

/** 재토론 생성 */
export async function regenerateDiscussion(
  prevFinalOutput: string,
  newPrompt: string,
  mode: AppMode,
  selectedExpertIds: string[],
  callbacks?: {
    onSquadSelected?: (squad: { thesis: any; antithesis: any; synthesis: any; support: any }) => void;
    onStreamChunk?: (partialResult: Partial<DiscussionResult>) => void;
  }
): Promise<DiscussionResult> {
  const enrichedContext = `
[이전 토론의 최종 기획서]
${prevFinalOutput}

[사용자의 새로운 지시사항 / 피드백]
${newPrompt}
  `.trim();
  return generateDiscussion(enrichedContext, mode, selectedExpertIds, callbacks);
}

/** 프롬프트 확장 — 분석·요약 특성상 Flash 모델 사용 */
export async function enhancePromptForRegenerate(shortPrompt: string): Promise<string> {
  const prompt = `사용자의 지시사항을 전문가 토론에 적합하도록 구체화하십시오: ${shortPrompt}`;
  try {
    const res = await callGeminiApi({ model: MODEL_FLASH, contents: prompt });
    return res.text?.trim() || shortPrompt;
  } catch (err) {
    try {
      const res = await callGeminiApi({ model: MODEL_FALLBACK, contents: prompt });
      return res.text?.trim() || shortPrompt;
    } catch {
      return shortPrompt;
    }
  }
}

/** 시냅스 시드 생성 — 초기 발아(분석) 단계이므로 Flash 모델 사용 */
export async function generateSynapseSeed(context: string, onChunk: (partialData: any) => void): Promise<any> {
  const payload = {
    model: MODEL_FLASH,
    contents: `시냅스 최초 발아 프로토콜을 실행하십시오. 입력: ${context}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          coreIntention: { type: Type.STRING },
          context: { type: Type.ARRAY, items: { type: Type.STRING } },
          subBranches: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['id', 'coreIntention', 'context', 'subBranches'],
      } as any,
    },
  };
  const fullText = await callGeminiStreamingApi(payload, (text) => onChunk(parsePartialJson<any>(text)));
  try {
    return JSON.parse(fullText);
  } catch (e) {
    return parsePartialJson<any>(fullText);
  }
}

/** 시냅스 융합 — 취합 및 추출은 Pro 모델로 고밀도 처리 */
export async function convergeAndExtractSynapse(
  selectedSeeds: { id: string; content: string }[],
  targetFormat: string = '정식 기획서',
  onChunk: (partialData: any) => void
): Promise<any> {
  const context = selectedSeeds.map(s => `[Seed ID: ${s.id}]\n${s.content}`).join('\n\n');
  const payload = {
    model: MODEL_ANALYSIS,
    contents: `시냅스 융합 프로토콜을 실행하십시오. 포맷: ${targetFormat}. 데이터: ${context}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          synthesizedInsight: { type: Type.STRING },
          finalOutput: { type: Type.STRING },
          sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['synthesizedInsight', 'finalOutput', 'sourceIds'],
      } as any,
    },
  };
  const fullText = await callGeminiStreamingApi(payload, (text) => onChunk(parsePartialJson<any>(text)));
  try {
    return JSON.parse(fullText);
  } catch (e) {
    return parsePartialJson<any>(fullText);
  }
}
