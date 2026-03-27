import { GoogleGenAI, Type } from '@google/genai';
import { EXPERTS } from './experts';
import {
  SYNERGY_MATRIX,
  EXPERT_SUPPORT_MAP,
  EXPERT_PROFILES_COMPACT,
  MODE_SQUAD_MAP,
} from './synergyData';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── 모델 엔드포인트 ───────────────────────────────────────────────────────────
const MODEL_ANALYSIS          = 'gemini-3.1-pro-preview';
const MODEL_ANALYSIS_FALLBACK = 'gemini-2.5-pro';
const MODEL_SELECTOR          = 'gemini-3-flash-preview';
const MODEL_SELECTOR_FALLBACK = 'gemini-flash-latest';
const MODEL_ENHANCE           = 'gemini-3-flash-preview';
const MODEL_ENHANCE_FALLBACK  = 'gemini-flash-latest';

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
  metacognitiveDefinition: MetacognitiveDefinition;
  workflowSimulationLog: string;
  thesis: ExpertTurn;
  antithesis: ExpertTurn;
  synthesis: ExpertTurn;
  support: ExpertTurn;
  shortFinalOutput: string;
  finalOutput: string;
  transparencyReport: TransparencyReport;
}

// ─── 내부 구조체: Selector 응답 ────────────────────────────────────────────────
interface SquadSelection {
  detectedMode: 'A' | 'B' | 'C';  // G4: Mode 판단 결과 추가
  thesisId: string;
  antithesisId: string;
  synthesisId: string;
  supportId: string;
  reason: string;
}

/**
 * [Step 1] 지능형 전문가 선정 + Mode 판단 — gemini-3-flash-preview
 *
 * G4 해결: Selector가 Mode(A/B/C)를 먼저 판단하고,
 *           MODE_SQUAD_MAP 고정 Squad를 우선 적용합니다.
 *           사용자가 특정 전문가를 제외한 경우에만 시너지 매트릭스로 보완합니다.
 */
export async function selectExpertSquad(
  context: string,
  availableIds: string[]
): Promise<SquadSelection> {
  const availableProfiles = EXPERT_PROFILES_COMPACT.filter(
    (e) => availableIds.includes(e.id)
  );

  const validCombos = SYNERGY_MATRIX.filter((combo) =>
    combo.core.every((id) => availableIds.includes(id))
  );

  // Mode Squad 맵을 문자열로 직렬화하여 Selector에게 전달
  const modeMapSummary = Object.entries(MODE_SQUAD_MAP).map(
    ([mode, sq]) =>
      `Mode ${mode} (${sq.label}): Core=[${sq.core.join(',')}] Support=${sq.support} | 트리거: ${sq.trigger}`
  ).join('\n');

  const selectorPrompt = `
당신은 GEMS 프로토콜의 전문가 스쿼드 선정 AI입니다.
사용자의 기획 컨텍스트를 분석하여 다음 2가지를 수행하십시오.

# [Task 1] Mode 판단 (우선 순위 1위)
아래 Mode 정의를 참고하여 사용자 컨텍스트에 가장 부합하는 Mode를 선택하십시오.
- Mode A: 신규 사업 기획. 0에서 1을 만드는 과업. (신제품, 창업, 신시장 진출)
- Mode B: 기존 사업 개선. 이미 존재하는 것을 더 낫게. (효율화, 비용 절감, 최적화)
- Mode C: 위기 대응. 급변하는 환경 속 생존. (매출 급락, 경쟁 위기, 피벗)
※ 주제가 탐구적·개념적·학술적 성격이라면 Mode A에 가장 가깝습니다.

# [Task 2] Mode 기반 고정 Squad (우선 순위 2위)
판단된 Mode에 따라 아래 고정 Squad 테이블에서 4인을 먼저 선정하십시오.
단, 해당 ID가 선택 가능한 목록에 없을 경우에만 시너지 매트릭스로 보완합니다.

## Mode 기반 Squad 테이블
${modeMapSummary}

## 시너지 매트릭스 (보완용)
${JSON.stringify(validCombos.length > 0 ? validCombos.slice(0, 5) : SYNERGY_MATRIX.slice(0, 5), null, 2)}

# 선택 가능한 전문가 목록
${JSON.stringify(availableProfiles, null, 2)}

# 사용자 기획 컨텍스트
${context}
`.trim();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SELECTOR,
      contents: selectorPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedMode:   { type: Type.STRING, description: 'A, B, C 중 하나' },
            thesisId:       { type: Type.STRING, description: '제안 전문가 ID' },
            antithesisId:   { type: Type.STRING, description: '반박 전문가 ID' },
            synthesisId:    { type: Type.STRING, description: '통합 전문가 ID' },
            supportId:      { type: Type.STRING, description: '검증 전문가 ID' },
            reason:         { type: Type.STRING, description: '선정 이유 (한 문장)' },
          },
          required: ['detectedMode', 'thesisId', 'antithesisId', 'synthesisId', 'supportId', 'reason'],
        } as any,
      },
    });

    const result = JSON.parse(response.text ?? '{}') as SquadSelection;

    const allIds = [result.thesisId, result.antithesisId, result.synthesisId, result.supportId];
    const isValid = allIds.every((id) => availableIds.includes(id));

    if (!isValid) {
      console.warn('[Selector] 유효하지 않은 ID 반환, Fallback 적용');
      return buildFallbackSquad(availableIds);
    }

    console.info(`[Selector] Mode ${result.detectedMode} | Squad: ${allIds.join(', ')} — ${result.reason}`);
    return result;
  } catch (err) {
    console.warn('[Selector] API 실패, Fallback 사용:', err);
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: MODEL_SELECTOR_FALLBACK,
        contents: selectorPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedMode:   { type: Type.STRING },
              thesisId:       { type: Type.STRING },
              antithesisId:   { type: Type.STRING },
              synthesisId:    { type: Type.STRING },
              supportId:      { type: Type.STRING },
              reason:         { type: Type.STRING },
            },
            required: ['detectedMode', 'thesisId', 'antithesisId', 'synthesisId', 'supportId', 'reason'],
          } as any,
        },
      });
      const fallbackResult = JSON.parse(fallbackResponse.text ?? '{}') as SquadSelection;
      const allIds = [fallbackResult.thesisId, fallbackResult.antithesisId, fallbackResult.synthesisId, fallbackResult.supportId];
      if (allIds.every((id) => availableIds.includes(id))) return fallbackResult;
    } catch (_) {}
    return buildFallbackSquad(availableIds);
  }
}

/**
 * Selector 실패 시 폴백: 시너지 매트릭스 1위 조합 + 최적 Support
 */
function buildFallbackSquad(availableIds: string[]): SquadSelection {
  const validCombo = SYNERGY_MATRIX.find((combo) =>
    combo.core.every((id) => availableIds.includes(id))
  ) ?? SYNERGY_MATRIX[0];

  const [thesisId, antithesisId, synthesisId] = validCombo.core;

  const coreSet = new Set([thesisId, antithesisId, synthesisId]);
  const supportId =
    Object.entries(EXPERT_SUPPORT_MAP)
      .filter(([id]) => availableIds.includes(id) && !coreSet.has(id))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ??
    availableIds.find((id) => !coreSet.has(id)) ??
    availableIds[3];

  return { detectedMode: 'A', thesisId, antithesisId, synthesisId, supportId, reason: '시너지 매트릭스 최우선 조합 자동 적용' };
}

/**
 * [Step 2] 변증법적 토론 생성 — gemini-3.1-pro-preview
 *
 * G5 해결: 역할 간섭 방지(Anti-Interference Protocol) 명시
 * G6 해결: 제약 공학(기회비용, 리드타임, 경쟁자 반격 시나리오) 강제 주입
 */
export async function generateDiscussion(
  context: string,
  mode: string | null,
  selectedExpertIds: string[]
): Promise<DiscussionResult> {
  // ── Step 1: 지능형 전문가 선정 ──────────────────────────────────────────────
  const squad = await selectExpertSquad(context, selectedExpertIds);

  const getExpert = (id: string) => {
    const expert = EXPERTS.find((e) => e.id === id);
    if (!expert) throw new Error(`전문가 ID를 찾을 수 없습니다: ${id}`);
    return expert;
  };

  const thesis     = getExpert(squad.thesisId);
  const antithesis = getExpert(squad.antithesisId);
  const synthesis  = getExpert(squad.synthesisId);
  const support    = getExpert(squad.supportId);

  const detectedMode = squad.detectedMode ?? 'A';
  const modeLabel: Record<string, string> = {
    A: 'Mode A — 신규 사업 기획 (Zero to One)',
    B: 'Mode B — 기존 사업 개선 (Optimization)',
    C: 'Mode C — 위기 대응 (Crisis Survival)',
  };

  // ── Step 2: Discussion 프롬프트 — 프로토콜 전 계층 완전 반영 ──────────────
  const discussionPrompt = `
# GEMS Protocol — Active Metacognitive Architect (ES-MoE v4.5)

당신은 **능동형 메타인지 설계자(Active Metacognitive Architect)**이며,
사용자의 입력을 실제 리소스가 투입될 **'비즈니스 실행 지시서(Work Order)'**로 간주합니다.
목표는 **'실행 전 완전성(Pre-Execution Completeness)'** 확보입니다.

---

## Layer 0: 불문율 — 최상위 작동 원리 (Background OS)
응답 생성 전 아래 7원칙이 백그라운드에서 실시간으로 작동합니다.
1. **깊이(深度):** 표면적 답변을 거부하고 본질을 탐구한다.
2. **진실(眞實):** 불확실성을 있는 그대로 노출하고 모르면 모른다고 인정한다.
3. **도움(助益):** 즉각적 실용성과 장기적 성장을 동시에 추구한다.
4. **창조(創造):** 예측 가능한 답변과 뻔한 결론을 시스템 차원에서 거부한다.
5. **균형(均衡):** 이론적 엄밀성과 실용적 적용성의 최적 균형점을 찾는다.
6. **연결(連結):** 고립된 사고를 거부하고 전체 맥락을 유기적 생태계로 인식한다.
7. **초월(超越):** 기존 틀을 의심하고 지속적으로 진화하는 용기를 갖는다.

---

## Layer 1: 작동 모드 (Mode)
시스템이 판단한 프로젝트 모드: **${modeLabel[detectedMode]}**

---

## Layer 2: 소집된 전문가 스쿼드 (Squad) — 역할 간섭 방지 프로토콜 적용

선발된 4인은 **자신의 방법론에서만 발언**하며 역할 경계를 엄격히 지킵니다.

### [제안 Thesis] ${thesis.personaName} (${thesis.name})
방법론: ${thesis.framework}
역할 제한: 전략적 방향과 진단만 제공. 구체적 실행 로드맵 작성 금지.

### [반박 Antithesis] ${antithesis.personaName} (${antithesis.name})
방법론: ${antithesis.framework}
역할 제한: ${thesis.personaName}의 제안에서 논리적 맹점·인과 오류·가정의 허점만 집요하게 공격(Red Teaming). 새로운 아이디어 제안 금지. 단순 동의(Agree) 발언은 시스템 Rejected.

### [통합 Synthesis] ${synthesis.personaName} (${synthesis.name})
방법론: ${synthesis.framework}
역할 제한: 앞선 제안과 반박의 충돌을 흡수하여 양자의 장점을 모두 취한 제3의 대안을 창조. 추상적 개념 논의만 하는 것은 금지.

### [검증 Support] ${support.personaName} (${support.name})
방법론: ${support.framework}
역할 제한: 인과 관계 검증, 가정의 타당성 심문, 숨겨진 리스크 노출에만 집중. 새로운 전략 제안 금지.

---

## Layer 3: 출력 규약 (Section 8 Protocol)

### 8.1 Metacognitive Definition
- selectedMode: 판단한 Mode (예: "Mode A — 신규 사업 기획 (Zero to One)")와 선정 사유 1줄
- projectDefinition: 이 프로젝트의 비즈니스적 본질을 1문장으로 정의
- activeSquadReason: 이 4인이 선발된 이유 — 시너지 논리 포함

### 8.2 Workflow Simulation Log
가상의 전략 회의실(War Room) 스크립트 형식으로 기술합니다.
- [${thesis.personaName}의 제안] → [${antithesis.personaName}의 반박] → [${synthesis.personaName}의 통합] → [${support.personaName}의 검증]
- 수평적이고 직설적인(Candid) 분위기. 단순 동의 없이 반드시 추가 관점이나 리스크 지적 포함.
- **[중요]** 매우 자연스럽고 이해하기 쉬운 일상적인 대화체(구어체)로 작성할 것. 지나치게 현학적이거나 어려운 AI 특유의 번역투, 전문 용어 반자동 나열을 자제하고, 실제 사람들이 회의실에서 말하는 것처럼 자연스럽게 표현할 것.

### 8.3 Final Output: 통합 전략 기획서 (Work Order)
마크다운 형식으로 다음 4계층을 포함합니다.
**[중요 가독성 지침]** 절대로 하나의 거대한 문단으로 텍스트를 뭉쳐서 출력하지 마세요! 가독성을 위해 반드시 다음을 지키십시오.
1. 각 계층과 항목 사이에는 반드시 **줄바꿈(엔터 2번, \\n\\n)**을 명확히 넣어 문단을 분리할 것.
2. **마크다운 제목 위계** (예: \`### 1. Executive Summary\`)를 적극 사용할 것.
3. 텍스트 내 중요한 개념은 **볼드체(**텍스트**)**로 시각적 강조(위계)를 줄 것.
4. 항목을 나열할 때는 **글머리 기호(-)** 나 번호 매기기를 엄격히 준수할 것.
1. **Executive Summary:** 핵심 명제 3줄.
2. **Strategic Layer:** 현황 진단 + JTBD 기반 가치 제안 + 시장 포지셔닝.
3. **Tactical Layer:** 역산 기획 기반 실행 로드맵(Phase 1~3) + 우선순위 Action Items + 자원 배분.
4. **Execution & Risk:** 아래 제약 공학 3요소를 **반드시** 포함할 것.
   - **기회비용(Opportunity Cost):** 이 전략을 선택함으로써 포기하는 대안은 무엇인가?
   - **리드타임(Physical Lead Time):** 각 단계의 물리적 최소 소요 시간을 명시.
   - **경쟁자 반격 시나리오(Counter-Attack):** 핵심 경쟁자가 1달 먼저 움직인다면?

### 8.4 Metacognitive Transparency Report
- selfHealingLog: 시뮬레이션 중 발견한 논리적 맹점이나 편향, 불문율로 어떻게 교정했는지.
- truthfulnessCheck: 이 기획의 **가장 취약한 고리(Weakest Link)** — 현재 시점에서 100% 확언 불가능한 전제를 정직하게 고백.
- realImpact: 이 전략이 사용자의 장기적 성장에 창출하는 실질적 가치.
- nextActionSuggestion: 사용자가 모니터를 끄고 지금 당장 실행해야 할 첫 번째 행동.

### 8.5 shortFinalOutput: Final Plan 요약본
위 8.3 Final Output의 방대한 내용을 4~5줄 분량의 핵심 요약 브리핑으로 변환하여 출력. 
사용자에게 직접 브리핑하는 것처럼 자연스럽고 직관적인 대화체로 작성할 것. 나중에 노드의 요약 카드 뷰에서 보여질 텍스트임.

---

## 전문가 발언 품질 기준

### keywords (핵심 키워드)
해당 전문가가 제기한 내용과 판단을 가장 잘 요약하는 핵심 키워드 5개 (명사형).

### shortContent (노드 요약)
핵심 주장 1줄. 실명(personaName)의 관점에서, 일상적인 어투로 자연스럽게 발언.
예시: 고객이 이 품목을 고르는 진짜 이유는 단순 맛이 아니라 불안 해소예요.

### fullContent (상세 발언)
3~5문장. 자신의 방법론을 명확히 적용하되, 마크다운 기호(#, **, - 등) 금지. 
어려운 워딩을 남발하지 말고, 회의실에서 사람에게 직접 말하는 것처럼 자연스럽고 전달력 있는 대화체를 사용할 것.
발언 끝에 반드시 다음 발언자에게 던지는 날카로운 질문 또는 리스크 지적을 포함.

---

## 사용자 기획 컨텍스트
${context}
`.trim();

  const config = {
    responseMimeType: 'application/json',
    temperature: 0.85, // 창의성 확보 + 다양성 유지
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        metacognitiveDefinition: {
          type: Type.OBJECT,
          properties: {
            selectedMode:      { type: Type.STRING },
            projectDefinition: { type: Type.STRING },
            activeSquadReason: { type: Type.STRING },
          },
          required: ['selectedMode', 'projectDefinition', 'activeSquadReason'],
        },
        workflowSimulationLog: { type: Type.STRING },
        thesis: {
          type: Type.OBJECT,
          properties: {
            expertId:     { type: Type.STRING },
            role:         { type: Type.STRING },
            keywords:     { type: Type.ARRAY, items: { type: Type.STRING } },
            shortContent: { type: Type.STRING },
            fullContent:  { type: Type.STRING },
          },
          required: ['expertId', 'role', 'keywords', 'shortContent', 'fullContent'],
        },
        antithesis: {
          type: Type.OBJECT,
          properties: {
            expertId:     { type: Type.STRING },
            role:         { type: Type.STRING },
            keywords:     { type: Type.ARRAY, items: { type: Type.STRING } },
            shortContent: { type: Type.STRING },
            fullContent:  { type: Type.STRING },
          },
          required: ['expertId', 'role', 'keywords', 'shortContent', 'fullContent'],
        },
        synthesis: {
          type: Type.OBJECT,
          properties: {
            expertId:     { type: Type.STRING },
            role:         { type: Type.STRING },
            keywords:     { type: Type.ARRAY, items: { type: Type.STRING } },
            shortContent: { type: Type.STRING },
            fullContent:  { type: Type.STRING },
          },
          required: ['expertId', 'role', 'keywords', 'shortContent', 'fullContent'],
        },
        support: {
          type: Type.OBJECT,
          properties: {
            expertId:     { type: Type.STRING },
            role:         { type: Type.STRING },
            keywords:     { type: Type.ARRAY, items: { type: Type.STRING } },
            shortContent: { type: Type.STRING },
            fullContent:  { type: Type.STRING },
          },
          required: ['expertId', 'role', 'keywords', 'shortContent', 'fullContent'],
        },
        shortFinalOutput: { type: Type.STRING },
        finalOutput:      { type: Type.STRING },
        transparencyReport: {
          type: Type.OBJECT,
          properties: {
            selfHealingLog:       { type: Type.STRING },
            truthfulnessCheck:    { type: Type.STRING },
            realImpact:           { type: Type.STRING },
            nextActionSuggestion: { type: Type.STRING },
          },
          required: ['selfHealingLog', 'truthfulnessCheck', 'realImpact', 'nextActionSuggestion'],
        },
      },
      required: [
        'metacognitiveDefinition', 'workflowSimulationLog',
        'thesis', 'antithesis', 'synthesis', 'support',
        'shortFinalOutput', 'finalOutput', 'transparencyReport',
      ],
    },
  } as any;

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL_ANALYSIS,
      contents: discussionPrompt,
      config,
    });
  } catch (primaryError) {
    console.warn(`[Discussion] ${MODEL_ANALYSIS} 실패, Fallback 사용:`, primaryError);
    response = await ai.models.generateContent({
      model: MODEL_ANALYSIS_FALLBACK,
      contents: discussionPrompt,
      config,
    });
  }

  const resultText = response.text;
  if (!resultText) throw new Error('No response from Gemini');

  const result = JSON.parse(resultText) as DiscussionResult;

  // ── Step 3: 데이터 정제 (이상 개행 문자 처리) ────────────────────────────────
  const sanitize = (text: string) => {
    if (!text) return text;
    return text
      .replace(/\\nWn/g, '\n')
      .replace(/\\Wn/g, '\n')
      .replace(/₩n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\W/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\n\n+/g, '\n\n');
  };

  result.finalOutput            = sanitize(result.finalOutput || '');
  result.shortFinalOutput       = sanitize(result.shortFinalOutput || '');
  result.workflowSimulationLog  = sanitize(result.workflowSimulationLog || '');

  if (result.thesis)     result.thesis.fullContent     = sanitize(result.thesis.fullContent || '');
  if (result.antithesis) result.antithesis.fullContent = sanitize(result.antithesis.fullContent || '');
  if (result.synthesis)  result.synthesis.fullContent  = sanitize(result.synthesis.fullContent || '');
  if (result.support)    result.support.fullContent    = sanitize(result.support.fullContent || '');

  // expertId·role·keywords 강제 할당 방어
  result.thesis.expertId      = thesis.id;     result.thesis.role     = 'thesis';
  result.thesis.keywords      = result.thesis.keywords ?? [];
  result.antithesis.expertId  = antithesis.id; result.antithesis.role = 'antithesis';
  result.antithesis.keywords  = result.antithesis.keywords ?? [];
  result.synthesis.expertId   = synthesis.id;  result.synthesis.role  = 'synthesis';
  result.synthesis.keywords   = result.synthesis.keywords ?? [];
  result.support.expertId     = support.id;    result.support.role    = 'support';
  result.support.keywords     = result.support.keywords ?? [];

  return result;
}

/** Re-generate: 기존 finalOutput + 새 프롬프트를 기반으로 재토론 */
export async function regenerateDiscussion(
  prevFinalOutput: string,
  newPrompt: string,
  selectedExpertIds: string[]
): Promise<DiscussionResult> {
  const enrichedContext = `
[이전 토론의 최종 기획서]
${prevFinalOutput}

[사용자의 새로운 지시사항 / 피드백]
${newPrompt}

위의 이전 기획서와 새로운 지시사항을 반드시 함께 고려하여,
기존 전략을 수정하거나 특정 파트를 심화(Deep Dive)시키는 방향으로 재토론을 진행하라.
  `.trim();
  return generateDiscussion(enrichedContext, null, selectedExpertIds);
}

/** Enhanced Prompt: 짧은 지시사항을 풍부한 토론 컨텍스트로 확장 */
export async function enhancePromptForRegenerate(shortPrompt: string): Promise<string> {
  const prompt = `
다음은 사용자가 전략 재생성을 위해 짧게 입력한 지시사항입니다.
이를 14인 전문가 토론에 투입하기에 적합하도록, 논리적이고 구체적인 토론 컨텍스트 형태로 확장하십시오.
마크다운이나 HTML 기호 없이 자연어 줄글로만 출력하십시오. 2~3문장으로 완성합니다.

원본 지시사항:
${shortPrompt}
`;
  try {
    const res = await ai.models.generateContent({
      model: MODEL_ENHANCE,
      contents: prompt,
    });
    return res.text?.trim() ?? shortPrompt;
  } catch (err) {
    console.warn(`[Enhance] ${MODEL_ENHANCE} 실패, Fallback 사용:`, err);
    try {
      const fallbackRes = await ai.models.generateContent({
        model: MODEL_ENHANCE_FALLBACK,
        contents: prompt,
      });
      return fallbackRes.text?.trim() ?? shortPrompt;
    } catch (_) {
      return shortPrompt;
    }
  }
}
