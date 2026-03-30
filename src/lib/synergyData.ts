import { Expert } from './experts';

/**
 * EXPERT_PROFILES_COMPACT — AI 선발 프롬프트 최적화를 위한 압축 프로필
 * AI가 안건에 적합한 전문가를 정확히 매칭할 수 있도록 키워드를 포함합니다.
 */
export const EXPERT_PROFILES_COMPACT = [
  { id: 'T01', role: '통합 조율가', keywords: ['#통합사고', '#제3의대안'], logic: '동시 유효 모델 찾기' },
  { id: 'T02', role: '본질 진단가', keywords: ['#본질분석', '#핵심도전'], logic: '현상-원칙-행동 커널' },
  { id: 'T03', role: '창발적 해석가', keywords: ['#현장학습', '#패턴인식'], logic: '경험적 패턴 포착' },
  { id: 'T04', role: '구조적 분석가', keywords: ['#입지분석', '#경쟁우위'], logic: '가치사슬 및 입지 분석' },
  { id: 'T05', role: '혁신 설계자', keywords: ['#본질과업', '#파괴적전환'], logic: '본질적 과업(JTBD) 재정의' },
  { id: 'T06', role: '본질적 통찰가', keywords: ['#목적정의', '#근본질문'], logic: '5가지 근본 질문 던지기' },
  { id: 'T07', role: '유연한 전략가', keywords: ['#빠른전환', '#기회포착'], logic: '민첩한 태세 전환 및 기회 포착' },
  { id: 'T08', role: '인과적 검증자', keywords: ['#인과관계', '#논리검증'], logic: '반사실적 추론 및 논리 검증' },
  { id: 'P01', role: '역산 설계자', keywords: ['#미래역산', '#최종경험'], logic: '최종 성공 상태에서 역산하기' },
  { id: 'P02', role: '실용적 행동가', keywords: ['#변곡점감지', '#집중실행'], logic: '전략적 변곡점 및 집중 실행' },
  { id: 'P03', role: '시스템 구축가', keywords: ['#생태계설계', '#지속가능플랫폼'], logic: '지속 가능한 생태계 플랫폼 설계' },
  { id: 'P04', role: '경험 비평가', keywords: ['#직관적완성', '#단순화'], logic: '직관적 완성도 및 극단적 단순화' },
  { id: 'P05', role: '원리 탐구자', keywords: ['#제1원리', '#근본해체'], logic: '제1원리 사고 및 근본 해체' },
  { id: 'P06', role: '원칙 체계화자', keywords: ['#알고리즘사고', '#투명성'], logic: '판단 과정의 알고리즘화 및 투명성' },
];

/**
 * SYNERGY_MATRIX — 전문가 간 협업 시너지 점수 (0~10)
 */
export const SYNERGY_MATRIX = [
  { pair: ['T01', 'T08'], score: 9.5, reason: '통합 모델의 논리적 무결성 검증' },
  { pair: ['T05', 'P04'], score: 9.2, reason: '과업 재정의와 직관적 경험의 결합' },
  { pair: ['P01', 'P02'], score: 9.0, reason: '미래 역산과 실질적 행동의 동기화' },
  { pair: ['T02', 'P05'], score: 8.8, reason: '진단 커널과 제1원리 사고의 정합성' },
  { pair: ['T06', 'P06'], score: 8.5, reason: '근본 목적과 원칙 시스템의 일치' },
  { pair: ['T04', 'T02'], score: 8.7, reason: '구조 분석과 전략 진단의 수직 계열화' },
  { pair: ['T03', 'T07'], score: 8.4, reason: '창발적 학습과 유연한 태세 전환의 시너지' },
  { pair: ['P03', 'P05'], score: 8.6, reason: '에코시스템 설계와 제1원리 물리적 구현' },
  { pair: ['P04', 'P05'], score: 9.1, reason: '단순화의 미학과 기능적 본질의 결합' },
  { pair: ['T08', 'P06'], score: 9.4, reason: '인과 분석의 알고리즘화 및 자동 검증' },
  { pair: ['T01', 'T06'], score: 8.9, reason: '통합적 모델과 근본 가치의 동기화' },
  { pair: ['P02', 'P03'], score: 8.5, reason: '집중 실행과 시스템 구축의 조화' },
  { pair: ['T02', 'T04'], score: 8.8, reason: '위기 진단과 산업 구조 재배치' },
  { pair: ['P01', 'P04'], score: 8.3, reason: '미래 역산과 사용자 경험의 결합' },
  { pair: ['T05', 'T07'], score: 8.6, reason: '파괴적 혁신과 민첩한 파도타기' }
];

/**
 * EXPERT_SUPPORT_MAP — 특정 전문가를 서포트하기에 최적인 파트너
 */
export const EXPERT_SUPPORT_MAP: Record<string, string[]> = {
  T01: ['T08', 'P06', 'T06'],
  T02: ['P05', 'T04', 'T08'],
  T03: ['T07', 'P01', 'P02'],
  T04: ['T02', 'P03', 'T06'],
  T05: ['P04', 'P01', 'T07'],
  T06: ['P06', 'T01', 'T02'],
  T07: ['T03', 'T05', 'P02'],
  T08: ['P06', 'T01', 'P05'],
  P01: ['P02', 'T03', 'P04'],
  P02: ['P01', 'P03', 'T07'],
  P03: ['P02', 'P05', 'T04'],
  P04: ['T05', 'P01', 'P05'],
  P05: ['T08', 'P04', 'T02'],
  P06: ['T08', 'T06', 'P05'],
};

/**
 * MODE_SQUAD_MAP — 안건 성격(Mode)에 따른 최적화된 스쿼드 구성 지침
 */
export const MODE_SQUAD_MAP = {
  A: {
    label: '창의적 탐구 (Creative Exploration)',
    trigger: '새로운 발견, 창조적 발상, 제약 없는 탐색, 미래 예측',
    focus: '가능성의 확장과 전례 없는 아이디어 도출',
    squad: { thesis: 'T05', antithesis: 'T08', synthesis: 'T01', support: 'P04' },
  },
  B: {
    label: '논리적 심화 (Logical Analysis)',
    trigger: '안건 분석, 구조적 모순 해결, 최적화, 정합성 검증',
    focus: '현상의 입체적 분석과 논리적 완성도 추구',
    squad: { thesis: 'T04', antithesis: 'T02', synthesis: 'T08', support: 'P06' },
  },
  C: {
    label: '실용적 해법 (Practical Solutions)',
    trigger: '문제 해결, 즉각적 대응, 실행력 강화, 실제적 결과',
    focus: '현실 제약 조건 내에서의 최선안 도출과 실행 로드맵',
    squad: { thesis: 'P02', antithesis: 'T03', synthesis: 'P01', support: 'P05' },
  },
};
