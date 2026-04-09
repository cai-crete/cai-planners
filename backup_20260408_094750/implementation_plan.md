# 기획자들 - 환경 세팅 및 Google API 연동

## 프로젝트 분석 요약

**기획자들**은 React + Vite + TypeScript + ReactFlow 기반의 **ES-MoE(Mixture of Experts) 다중 전문가 변증법 토론 엔진** 앱입니다.

- **핵심 플로우**: 사용자가 캔버스에 Sticky Note 추가 → 노드 선택 후 `GENERATE` 버튼 클릭 → Gemini API가 3명의 전문가(제안/반박/통합)로 변증법 토론 생성 → 캔버스에 Discussion Node로 등장
- **전문가 풀**: `EXPERTS` 배열에 정의된 14명 (Roger Martin, Porter, Drucker, Bezos, Jobs 등)
- **데이터 영속성**: IndexedDB(`idb` 라이브러리)로 프로젝트 저장

## 발견된 이슈

> [!WARNING]
> [gemini.ts](file:///c:/Users/%ED%81%AC%EB%A6%AC%ED%8A%B8/Downloads/%EA%B8%B0%ED%9A%8D%EC%9E%90%EB%93%A4/src/lib/gemini.ts) 53번째 줄에 **존재하지 않는 모델명** 사용 중:
> ```
> model: 'gemini-3-flash-preview'  ← 오타, API 호출 시 오류 발생
> ```
> 올바른 모델명: `gemini-2.0-flash`

> [!NOTE]
> [StickyNode.tsx](file:///c:/Users/%ED%81%AC%EB%A6%AC%ED%8A%B8/Downloads/%EA%B8%B0%ED%9A%8D%EC%9E%90%EB%93%A4/src/components/nodes/StickyNode.tsx) 34번째 줄의 [handleEnhance](file:///c:/Users/%ED%81%AC%EB%A6%AC%ED%8A%B8/Downloads/%EA%B8%B0%ED%9A%8D%EC%9E%90%EB%93%A4/src/components/nodes/StickyNode.tsx#30-38)는 현재 TODO 플레이스홀더 상태. AI로 노트 내용을 개선하는 실제 기능으로 구현 예정.

---

## Proposed Changes

### 1. 환경 변수 설정

#### [NEW] `.env.local`
- `GEMINI_API_KEY`에 제공된 Google API 키 설정
- `APP_URL` 로컬 개발 URL 설정

---

### 2. Gemini API 연동 수정

#### [MODIFY] [gemini.ts](file:///c:/Users/크리트/Downloads/기획자들/src/lib/gemini.ts)

- **모델명 수정**: `gemini-3-flash-preview` → `gemini-2.0-flash` (정식 지원 모델로 변경)

---

### 3. StickyNode AI 향상 기능 구현

#### [NEW] [enhanceNote.ts](file:///c:/Users/크리트/Downloads/기획자들/src/lib/enhanceNote.ts)
- `enhanceNote(text: string): Promise<string>` 함수 작성
- Gemini API 호출하여 노트 내용 요약/구체화/보강

#### [MODIFY] [StickyNode.tsx](file:///c:/Users/크리트/Downloads/기획자들/src/components/nodes/StickyNode.tsx)
- [handleEnhance](file:///c:/Users/%ED%81%AC%EB%A6%AC%ED%8A%B8/Downloads/%EA%B8%B0%ED%9A%8D%EC%9E%90%EB%93%A4/src/components/nodes/StickyNode.tsx#30-38) 내 TODO 제거 및 실제 `enhanceNote` 함수 연동
- 로딩 상태 추가 (Sparkles 버튼에 스피너 표시)

---

## Verification Plan

### 단계 1: 의존성 설치
```powershell
cd "c:\Users\크리트\Downloads\기획자들"
npm install
```

### 단계 2: 개발 서버 시작
```powershell
npm run dev
```
→ `http://localhost:3000` 에서 앱 실행 확인

### 단계 3: API 연동 테스트 (브라우저)
1. 브라우저에서 `http://localhost:3000` 접속
2. 캔버스에 Sticky Note 추가 (왼쪽 패널 📝 버튼)
3. 더블클릭하여 "신제품 출시 전략 수립" 텍스트 입력
4. 노드 선택 후 하단 `GENERATE` 버튼 클릭
5. **예상 결과**: 3개의 Discussion Node(제안/반박/통합)가 캔버스에 순차 생성
6. Sparkles(✨) 버튼 클릭 시 노트 내용이 AI로 향상되는지 확인
