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
const MODEL_ANALYSIS = 'gemini-3-flash-preview';
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
 * 키워드 문자열 정제 유틸리티
 */
function sanitizeKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  // 콤마, 샵, 줄바꿈으로만 구분하여 구절(공백 포함) 보존
  return text
    .split(/[,#\n]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
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
  },
  imageData?: string // [VISION]
): Promise<DiscussionResult> {
  const getExpert = (idOrName: string) => {
    const id = idOrName.replace(/[₩\\]n/g, '').trim();
    // 1. ID로 우선 검색
    let expert = EXPERTS.find((e) => e.id === id);
    if (expert) return expert;

    // 2. 이름(직업명)으로 검색 (Fallback)
    expert = EXPERTS.find((e) => e.name === id || e.personaName === id);
    if (expert) return expert;

    // 3. 정규식으로 대략적인 매칭
    expert = EXPERTS.find(e => id.includes(e.name) || e.name.includes(id));
    if (expert) return expert;

    return null; // [무결성 개선] 더 이상 EXPERTS[0]을 반환하지 않음
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
  
  const keywordProtocol = `
# PROTOCOL: SQUAD KEYWORD EXTRACTION (V3.1 - Quantitative Calibration)
- Density: '실질 형태소(명사, 수사, 용언의 어근)' 비중 80% 이상. (조사 배제)
- Position: 발언의 [초입부 20%] 또는 [종결부 20%] 공간 우선.
- Quantity: 발언당 최소 3개, 최대 4개의 핵심 포인트.
- Mode A (Creative): '고유 컨셉명/신조어' 비중 60% 이상.
- Mode B (Logical): '메커니즘/인과' 구조적 연결 명사 2개 이상 필수.
- Mode C (Practical): '수치/단위/기술자산' 포함 대상 1개 이상 필수.
`;

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
⚠️ 입력된 안건(Context)의 본질을 파악하여, 기획안(FINAL_PLAN)에서 구체적 액션 아이템만을 추출해 리포트하십시오.
- 분량: 반드시 3~4개의 글머리 기호(Bullet points) 단위로만 작성.
- 형식: [핵심 키워드] 형태의 대괄호가 가장 먼저 오고, 그 뒤에 해당 키워드에 대한 구체적인 결론 및 해결책을 1줄 이내로 서술.
- 절대 금지 사항: 예시 제공 금지, 추상적 표현 금지, 철학적 여운 금지.

[[METAC_DEF]]
판단한 탐구 모드(Mode)와 안건의 본질적 정의, 4인 선발 사유 기술.

[[THESIS_SHORT]]
⚠️ 제안자(Thesis)의 핵심 주장을 딸 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[THESIS]]
제안자가 첫 번째로 자연어 대화체로 발언한다. "이 안건에서 핵심은..."으로 시작하여, 자신의 고유 논리 프레임워크를 바탕으로 핵심 제안을 구어체로 전달한다. "…라고 봅니다", "…해야 한다고 생각합니다" 형식의 구어체 사용. 300자 이내.

[[ANTITHESIS_SHORT]]
⚠️ 반박자(Antithesis)의 핵심 반박을 딸 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[ANTITHESIS]]
반박자가 [[THESIS]]의 발언을 직접 지칭하며 시작한다. 반드시 "방금 [앞 발언자 직업명]께서 말씨하신 [핵심 주장]은 [이유] 때문에 재고가 필요합니다." 형식으로 시작하여 논리 헉점을 집요하게 공격하되 자연스러운 대화체 유지. 300자 이내.

[[SYNTHESIS_SHORT]]
⚠️ 통합자(Synthesis)의 핵심 통합안을 딸 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[SYNTHESIS]]
통합자가 [[THESIS]]와 [[ANTITHESIS]] 두 발언을 모두 언급하며 중재안을 제시한다. "두 분의 논쟁을 듣으면서..."또는 "[직업명]과 [직업명]의 입장을 종합하면..." 형식으로 시작하여 제3의 대안을 자연어로 제언. 300자 이내.

[[SUPPORT_SHORT]]
⚠️ 검증자(Support)의 핵심 검증 결론을 딸 1문장으로 압축. 마크다운 금지. 큰따옴표 없이 작성.

[[SUPPORT]]
검증자가 지금까지의 모든 발언을 검토하며 리스크와 논리 인과를 확인한다. "지금까지 논의를 들으면서..."또는 "앞선 세 분의 의견 중..." 형식으로 시작하여 논리 인과 검증 및 리스크 경고를 대화체로 제시. 300자 이내.

[[THESIS_KEYWORDS]] / [[ANTITHESIS_KEYWORDS]] / [[SYNTHESIS_KEYWORDS]] / [[SUPPORT_KEYWORDS]]
각 전문가 발언 직후 또는 마지막에 해당 역할의 전용 키워드를 추출하십시오. 콤마(,)로 구분하십시오.
⚠️ 반드시 아래 프로토콜을 준수해야 합니다:
${keywordProtocol}

[[FINAL_PLAN]]
상세 의견서 본문: 위계와 글머리 기호가 살아있는 정식 마크다운 문서.
⚠️ 추상적 요약을 지양하고, 즉시 실행 가능한 구체적 액션(Actionable Insights) 위주로 문서를 구성하십시오.
반드시 아래 구조를 포함하십시오:
### Final Output: 통합 전략 기획서
#### 1. 요약
#### 2. 전략
#### 3. 실행
#### 4. 리스크
### Metacognitive Definition
### Workflow Simulation Log
### Metacognitive Transparency Report

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
- **전문가 호칭 규칙**: [[SQUAD]] 태그 줄에서는 무조건 **고유 ID (예: T01, P04)** 만을 나열해야 합니다. 반면 이후의 모든 토론 본문([[THESIS]], [[ANTITHESIS]], [[SYNTHESIS]], [[SUPPORT]], [[FINAL_PLAN]]) 및 **Workflow Simulation Log** 내부에서 전문가를 지칭할 때는 ID 사용을 철저히 금지하고 무조건 **역할명**(예: 트렌드 분석가, 헤지펀드 매니저)을 사용하십시오.

---

## 토론 주제 및 맥락
${context}
`.trim();

  let squadApplied = false;
  // [무결성 개선] AI 답변과 상관없이 시스템이 선정한 명단을 우선순위로 강제 주입
  let currentSquadIds: string[] = [...selectedExpertIds];
  if (currentSquadIds.length < 4) {
    // 혹시 리스트가 부족할 경우에만 최소한의 안전장치 가동 (중복 방지)
    const filler = EXPERTS.filter(e => !currentSquadIds.includes(e.id));
    while (currentSquadIds.length < 4 && filler.length > 0) {
      currentSquadIds.push(filler.shift()!.id);
    }
  }

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
      const rawIds = squadRaw.split(',').map(id => id.replace(/[₩\\]n/g, '').trim()).filter(id => id.length > 0);
      const parsedIds = Array.from(new Set(rawIds)).filter(id => EXPERTS.some(e => e.id === id));
      const ids = [...parsedIds];
      
      // [무결성 개선] AI가 쓴 명단이 유효하다면 보조적으로 활용하되,
      // 기본적으로는 시스템에서 이미 배정한 순서(currentSquadIds)를 절대적으로 신뢰함.
      if (isSquadComplete && parsedIds.length === 4) {
        currentSquadIds = parsedIds;
      }
      
      const newSquadStr = ids.join(',');
      const isSquadChanged = newSquadStr !== (callbacks as any)?.lastSquadStr;

      if ((!squadApplied || isSquadChanged) && callbacks?.onSquadSelected) {
        (callbacks as any).lastSquadStr = newSquadStr;
        // [핵심 버그 수정] isSquadComplete 잠금을 해제하고, 즉시 UI를 업데이트합니다.
        // useStore의 깊은 병합(Deep Merge) 기능 덕분에 텍스트가 덮어씌워지는 오류가 시스템적으로 차단됩니다.
        // [BUG FIX] 화면이 요구하는 ExpertTurnData 하위 규격으로 맞춰서 전달
        callbacks.onSquadSelected({
          thesis: { expertId: currentSquadIds[0] || '', role: 'thesis', shortContent: '', fullContent: '', keywords: [] },
          antithesis: { expertId: currentSquadIds[1] || '', role: 'antithesis', shortContent: '', fullContent: '', keywords: [] },
          synthesis: { expertId: currentSquadIds[2] || '', role: 'synthesis', shortContent: '', fullContent: '', keywords: [] },
          support: { expertId: currentSquadIds[3] || '', role: 'support', shortContent: '', fullContent: '', keywords: [] },
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
          expertId: currentSquadIds[0] || '',
          role: 'thesis',
          keywords: sanitizeKeywords(extract(text, 'THESIS_KEYWORDS')),
        },
        antithesis: {
          shortContent: sanitizeShort(extract(text, 'ANTITHESIS_SHORT')),
          fullContent: extract(text, 'ANTITHESIS'),
          expertId: currentSquadIds[1] || '',
          role: 'antithesis',
          keywords: sanitizeKeywords(extract(text, 'ANTITHESIS_KEYWORDS')),
        },
        synthesis: {
          shortContent: sanitizeShort(extract(text, 'SYNTHESIS_SHORT')),
          fullContent: extract(text, 'SYNTHESIS'),
          expertId: currentSquadIds[2] || '',
          role: 'synthesis',
          keywords: sanitizeKeywords(extract(text, 'SYNTHESIS_KEYWORDS')),
        },
        support: {
          shortContent: sanitizeShort(extract(text, 'SUPPORT_SHORT')),
          fullContent: extract(text, 'SUPPORT'),
          expertId: currentSquadIds[3] || '',
          role: 'support',
          keywords: sanitizeKeywords(extract(text, 'SUPPORT_KEYWORDS')),
        },
        finalOutput: extract(text, 'FINAL_PLAN'),
      });
    }
  };

  // 토론 생성: 고밀도 출력이 필요하므로 MODEL_ANALYSIS (Pro) 사용
  const config = { temperature: 0.75, topP: 0.95 };
  
  // [VISION] imageData 유무에 따른 페이로드 구조 분기
  const contentsPayload = imageData ? [
    { text: discussionPrompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageData.replace(/^data:image\/(png|jpeg|webp);base64,/, '') } }
  ] : discussionPrompt;

  let fullText = '';
  try {
    fullText = await callGeminiStreamingApi(
      { model: MODEL_ANALYSIS, contents: contentsPayload, config },
      handleChunk
    );
  } catch (err) {
    console.error('[GEMS Error]', err);
    // 폴백 1: Flash 모델로 재시도
    try {
      console.warn('[GEMS] Pro 모델 실패. Flash 모델로 폴백...');
      fullText = await callGeminiStreamingApi(
        { model: MODEL_FLASH, contents: contentsPayload, config },
        handleChunk
      );
    } catch (flashErr) {
      // 폴백 2: 마지막 안전망
      try {
        console.warn('[GEMS] Flash 모델 실패. 최종 폴백...');
        fullText = await callGeminiStreamingApi(
          { model: MODEL_FALLBACK, contents: contentsPayload, config },
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
      expertId: getExpert(finalIds[0] || '')?.id || finalIds[0] || '',
      role: 'thesis',
      keywords: sanitizeKeywords(extract(fullText, 'THESIS_KEYWORDS')),
      shortContent: sanitizeShort(extract(fullText, 'THESIS_SHORT')),
      fullContent: extract(fullText, 'THESIS'),
    },
    antithesis: {
      expertId: getExpert(finalIds[1] || '')?.id || finalIds[1] || '',
      role: 'antithesis',
      keywords: sanitizeKeywords(extract(fullText, 'ANTITHESIS_KEYWORDS')),
      shortContent: sanitizeShort(extract(fullText, 'ANTITHESIS_SHORT')),
      fullContent: extract(fullText, 'ANTITHESIS'),
    },
    synthesis: {
      expertId: getExpert(finalIds[2] || '')?.id || finalIds[2] || '',
      role: 'synthesis',
      keywords: sanitizeKeywords(extract(fullText, 'SYNTHESIS_KEYWORDS')),
      shortContent: sanitizeShort(extract(fullText, 'SYNTHESIS_SHORT')),
      fullContent: extract(fullText, 'SYNTHESIS'),
    },
    support: {
      expertId: getExpert(finalIds[3] || '')?.id || finalIds[3] || '',
      role: 'support',
      keywords: sanitizeKeywords(extract(fullText, 'SUPPORT_KEYWORDS')),
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

/** 
 * [GEMS Protocol] 안건 분석을 통한 모드 자동 판별 엔진
 * 사용자의 프롬프트와 이전 맥락을 분석하여 A(혁신), B(효율), C(위기/실용) 중 하나를 선정합니다.
 */
export async function analyzePromptMode(
  prompt: string, 
  history: string = ""
): Promise<AppMode> {
  const analysisPrompt = `
# GEMS Mode Analyzer (Metacognitive Classification)

당신은 사용자의 안건을 분석하여 가장 적합한 탐구 모드를 결정하는 전략 분석가입니다.
아래 기준에 따라 안건을 분류하고, 반드시 해당 기호(A, B, 또는 C) 하나만 출력하십시오.

- **Mode A (Innovation/Creative)**: 새로운 발견, 창조적 발상, 제약 없는 탐색, 미래 예측, 신규 시장 진입, 기술적 돌파.
- **Mode B (Efficiency/Logical)**: 정합성 검증, 구조적 모순 해결, 최적화, 프로세스 개선, 기존 안건의 심층 분석.
- **Mode C (Crisis/Practical)**: 즉각적 문제 해결, 실행력 강화, 현실적 제약 조건(예산/시간) 하의 최선안 도출, 위기 대응.

[사용자 안건]
${prompt}

[이전 맥락 (참고용)]
${history}

반드시 기호(A, B, C) 한 글자만 대문자로 응답하십시오.
  `.trim();

  try {
    const res = await callGeminiApi({ 
      model: MODEL_FLASH, 
      contents: analysisPrompt,
      config: { temperature: 0.1 } // 분류 정확도를 위해 낮은 온도 설정
    });
    const detected = res.text?.trim().toUpperCase() || 'A';
    if (['A', 'B', 'C'].includes(detected)) return detected as AppMode;
    return 'A'; 
  } catch (err) {
    console.error('[Mode Analysis Error]', err);
    return 'A'; // Fallback
  }
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
  },
  imageData?: string // [VISION]
): Promise<DiscussionResult> {
  const enrichedContext = `
[이전 토론의 최종 기획서]
${prevFinalOutput}

[사용자의 새로운 지시사항 / 피드백]
${newPrompt}
  `.trim();
  return generateDiscussion(enrichedContext, mode, selectedExpertIds, callbacks, imageData);
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
