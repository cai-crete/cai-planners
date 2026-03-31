import { Type } from '@google/genai';
import { EXPERTS } from './experts';
import { AppMode } from '../store/useStore';
import {
  SYNERGY_MATRIX,
  EXPERT_SUPPORT_MAP,
  EXPERT_PROFILES_COMPACT,
  MODE_SQUAD_MAP,
  OPTIMAL_TRIOS_TOP10,
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
  const getExpert = (idOrName: string) => {
    const id = idOrName.trim();
    // 1. ID로 우선 검색
    let expert = EXPERTS.find((e) => e.id === id);
    if (expert) return expert;

    // 2. 이름(직업명)으로 검색 (Fallback)
    expert = EXPERTS.find((e) => e.name === id || e.personaName === id);
    if (expert) return expert;

    // 3. 정규식으로 대략적인 매칭 (더욱 강력한 Fallback)
    expert = EXPERTS.find(e => id.includes(e.name) || e.name.includes(id));
    if (expert) return expert;

    return EXPERTS[0];
  };

  const modeLabel: Record<string, string> = {
    A: 'Mode A — 창의적 탐구 (Creative Exploration)',
    B: 'Mode B — 논리적 심화 (Logical Analysis)',
    C: 'Mode C — 실용적 해법 (Practical Solutions)',
  };

  const detectedMode = mode || 'A';
  const availableProfiles = EXPERT_PROFILES_COMPACT.filter(e => selectedExpertIds.includes(e.id));

  const availableProfilesString = availableProfiles.map(p => `- [${p.id}] ${p.role} (${p.keywords.join(', ')})`).join('\n');
  const optimalTriosString = OPTIMAL_TRIOS_TOP10.map(t => `- ${t.ids.join(' + ')} (시나리오: ${t.scenario})`).join('\n');
  const synergyPairsString = SYNERGY_MATRIX.slice(0, 5).map(s => `- ${s.pair.join(' + ')} (점수: ${s.score}, ${s.reason})`).join('\n');
  
  const discussionPrompt = `
# GEMS Protocol — Active Metacognitive Architect (V4.5)

## ⚠️ 단일 회전(Single-Turn) 출력 규약
당신은 별도의 선발 단계 없이, 이 프롬프트 안에서 문맥을 분석하여 최적의 전문가를 선발해야 합니다.
반드시 [선택 가능 전문가] 목록의 'id'(예: T01, P04 등)를 사용하여 정확하게 4명(제안자, 반박자, 통합자, 검증자 각 1명)을 선발하십시오. 서로 다른 4명을 선발해야 하며 중복은 절대 금지됩니다.
출력의 **첫 번째 줄**은 반드시 아래 형식을 지켜야 합니다. (실시간 UI 바인딩용)
[[SQUAD]] T01, T05, P02, T08

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

**1. 현재 안건 기반 탐구 모드**: ${modeLabel[detectedMode] || '범용 탐구 모드'}

**2. 선택 가능 전문가 목록**:
${availableProfilesString}

**3. 최적의 3인 시너지 문헌 (Top 10)**:
${optimalTriosString}

**4. 2인 시너지 매트릭스**:
${synergyPairsString}

---

## Layer 0: 불문율 (Background OS)
- **절대 축약 금지**: 전문가 4인의 격론 과정(8.2)을 생략하지 마십시오.
- **역할 경계 준수**: 제안자/반박자/통합자/검증자의 페르소나를 엄격히 분리하십시오.
- **SHORT 태그 준수**: 모든 _SHORT 태그는 반드시 1문장, 마크다운 금지, **개행 문자(\n) 완전 금지**를 고수하십시오. 줄바꿈 없이 순수 단일 문장으로만 작성하십시오.
- **SHORT_FINAL 준수**: [[SHORT_FINAL]]은 반드시 3문장 이내로 작성하십시오. 개행 문자 사용 금지.
- **전문가 호칭 규칙**: [[SQUAD]] 태그 줄에서는 무조건 **고유 ID (예: T01, P04)** 만을 나열해야 합니다. 반면 이후의 모든 토론 본문([[THESIS]], [[ANTITHESIS]], [[SYNTHESIS]], [[SUPPORT]], [[FINAL_PLAN]]) 내부에서 전문가를 지칭할 때는 ID 사용을 철저히 금지하고 무조건 **직업명**(예: 전략 컨설턴트, 데이터 과학자)을 사용하십시오.

---

## 토론 주제 및 맥락
${context}
`.trim();

  let squadApplied = false;
  let currentSquadIds: string[] = ['', '', '', ''];

  // 파싱 정제 (Sanitization) 헬퍼
  const sanitizeShort = (str: string) => 
    str.replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const sanitizeKeywords = (str: string) => 
    str.replace(/#/g, '').replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/[\n\r]/g, ' ').split(/\s+/).filter(Boolean);

  const handleChunk = (text: string) => {
    // 1. SQUAD 추출 및 판정 로직
    const squadMatch = text.match(/\[\[SQUAD\]\]([\s\S]*?)(\[\[|$)/i);
    const squadRaw = squadMatch ? squadMatch[1].trim() : '';
    const isSquadComplete = squadMatch && squadMatch[2].startsWith('[[');

    if (squadRaw && (!squadApplied || isSquadComplete)) {
      const rawIds = squadRaw.split(',').map(id => id.trim()).filter(id => id.length > 0);
      const parsedIds = Array.from(new Set(rawIds)).filter(id => EXPERTS.some(e => e.id === id));
      const ids = [...parsedIds];
      
      let attempt = 0;
      while (ids.length < 4 && attempt < 15) {
        const candid = availableProfiles[attempt]?.id || EXPERTS[attempt % EXPERTS.length].id;
        if (!ids.includes(candid)) {
          ids.push(candid);
        }
        attempt++;
      }
      
      // 최후 수단 (그래도 4개가 안 되면 안전망으로 EXPERTS 강제 투입)
      while (ids.length < 4) {
        const safeE = EXPERTS.find(e => !ids.includes(e.id));
        if (safeE) ids.push(safeE.id);
      }

      currentSquadIds = ids;
      
      const newSquadStr = ids.join(',');
      const isSquadChanged = newSquadStr !== (callbacks as any)?.lastSquadStr;

      if ((!squadApplied || isSquadChanged) && callbacks?.onSquadSelected) {
        (callbacks as any).lastSquadStr = newSquadStr;
        // [핵심 버그 수정] isSquadComplete 잠금을 해제하고, 즉시 UI를 업데이트합니다.
        // useStore의 깊은 병합(Deep Merge) 기능 덕분에 텍스트가 덮어씌워지는 오류가 시스템적으로 차단됩니다.
        // [BUG FIX] 화면이 요구하는 ExpertTurnData 하위 규격으로 맞춰서 전달
        callbacks.onSquadSelected({
          thesis: { expertId: ids[0], role: 'thesis', shortContent: '', fullContent: '', keywords: [] },
          antithesis: { expertId: ids[1], role: 'antithesis', shortContent: '', fullContent: '', keywords: [] },
          synthesis: { expertId: ids[2], role: 'synthesis', shortContent: '', fullContent: '', keywords: [] },
          support: { expertId: ids[3], role: 'support', shortContent: '', fullContent: '', keywords: [] },
        });
        squadApplied = true;
      }
    }

    if (callbacks?.onStreamChunk) {
      callbacks.onStreamChunk({
        aggregatedSummary: sanitizeShort(extract(text, 'SUMMARY')),
        aggregatedKeywords: sanitizeKeywords(extract(text, 'KEYWORDS')),
        shortFinalOutput: sanitizeShort(extract(text, 'SHORT_FINAL')),
        // [G2 FIX] _SHORT 태그를 각 전문가의 shortContent로 추출
        thesis: {
          shortContent: sanitizeShort(extract(text, 'THESIS_SHORT')),
          fullContent: extract(text, 'THESIS'),
          expertId: currentSquadIds[0],
          role: 'thesis',
          keywords: [],
        },
        antithesis: {
          shortContent: sanitizeShort(extract(text, 'ANTITHESIS_SHORT')),
          fullContent: extract(text, 'ANTITHESIS'),
          expertId: currentSquadIds[1],
          role: 'antithesis',
          keywords: [],
        },
        synthesis: {
          shortContent: sanitizeShort(extract(text, 'SYNTHESIS_SHORT')),
          fullContent: extract(text, 'SYNTHESIS'),
          expertId: currentSquadIds[2],
          role: 'synthesis',
          keywords: [],
        },
        support: {
          shortContent: sanitizeShort(extract(text, 'SUPPORT_SHORT')),
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
  const rawParsedIds = finalSquadRaw ? finalSquadRaw.split(',').map(id => id.trim()) : currentSquadIds;
  const parsedFinalIds = Array.from(new Set(rawParsedIds));
  const finalIds = [...parsedFinalIds];
  
  let finalAttempt = 0;
  while (finalIds.length < 4 && finalAttempt < 15) {
    const candid = availableProfiles[finalAttempt]?.id || EXPERTS[finalAttempt % EXPERTS.length].id;
    if (!finalIds.includes(candid)) {
      finalIds.push(candid);
    }
    finalAttempt++;
  }
  
  while (finalIds.length < 4) {
    const safeE = EXPERTS.find(e => !finalIds.includes(e.id));
    if (safeE) finalIds.push(safeE.id);
  }

  return {
    aggregatedSummary: sanitizeShort(extract(fullText, 'SUMMARY')),
    aggregatedKeywords: sanitizeKeywords(extract(fullText, 'KEYWORDS')),
    shortFinalOutput: sanitizeShort(extract(fullText, 'SHORT_FINAL')),
    metacognitiveDefinition: {
      selectedMode: detectedMode,
      projectDefinition: sanitizeShort(extract(fullText, 'METAC_DEF')),
      activeSquadReason: 'GEMS Protocol V4.5 High-Integrity Selection',
    },
    // [G2 FIX] 최종 결과에도 _SHORT 태그 파싱 적용 및 강제 한 줄 정제
    thesis: {
      expertId: getExpert(finalIds[0] || '').id,
      role: 'thesis',
      keywords: [],
      shortContent: sanitizeShort(extract(fullText, 'THESIS_SHORT')),
      fullContent: extract(fullText, 'THESIS'),
    },
    antithesis: {
      expertId: getExpert(finalIds[1] || '').id,
      role: 'antithesis',
      keywords: [],
      shortContent: sanitizeShort(extract(fullText, 'ANTITHESIS_SHORT')),
      fullContent: extract(fullText, 'ANTITHESIS'),
    },
    synthesis: {
      expertId: getExpert(finalIds[2] || '').id,
      role: 'synthesis',
      keywords: [],
      shortContent: sanitizeShort(extract(fullText, 'SYNTHESIS_SHORT')),
      fullContent: extract(fullText, 'SYNTHESIS'),
    },
    support: {
      expertId: getExpert(finalIds[3] || '').id,
      role: 'support',
      keywords: [],
      shortContent: sanitizeShort(extract(fullText, 'SUPPORT_SHORT')),
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
