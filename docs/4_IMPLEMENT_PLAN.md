# 4. 구현 상세 계획

## 4.1 Phase 1 구현 순서

아래 순서로 구현한다. 각 단계는 이전 단계에 의존한다.

### Step 1: 프로젝트 부트스트랩

```bash
mkdir oh-my-codereview && cd oh-my-codereview
pnpm init
pnpm add typescript zod commander chalk
pnpm add -D vitest tsup @types/node
npx tsc --init
```

**작업 내역:**

- tsconfig.json 설정 (strict: true, ESM)
- tsup.config.ts 설정
- src/cli/index.ts 엔트리포인트 (commander 기반)
- [CLAUDE.md](http://CLAUDE.md) 배치
- .gitignore, .reviewignore 기본 파일

### Step 2: Config 시스템

**파일:** `src/config/schema.ts`, `src/config/loader.ts`, `src/config/defaults.ts`

```tsx
// schema.ts — 핵심 타입
const ReviewerSchema = z.object({
  name: z.string(),
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean().default(true),
  timeout: z.number().default(300),
});

const ConfigSchema = z.object({
  head_agent: z.object({
    provider: z.string(),
    model: z.string(),
    fallback_model: z.string().optional(),
  }),
  supporters: z.object({ ... }),
  reviewers: z.array(ReviewerSchema).min(1),
  settings: z.object({
    min_reviewers: z.number().default(3),
    max_parallel: z.number().default(5),
    output_format: z.enum(["json", "text", "markdown"]).default("json"),
    default_timeout: z.number().default(300),
  }),
});
```

**테스트:**

- 유효한 config 로딩 성공
- 필수 필드 누락 시 에러
- enabled 리뷰어 < min_reviewers 시 경고
- 기본값 적용 확인

### Step 3: Diff 추출기

**파일:** `src/diff/extractor.ts`, `src/diff/splitter.ts`, `src/diff/filter.ts`

**로직:**

1. `git diff main...HEAD` 또는 전달받은 diff 파일 읽기
2. 파일별로 분할 (`diff --git a/ b/` 패턴 기준)
3. `.reviewignore` 패턴 매칭으로 제외
4. 대형 파일(500줄+)은 함수 단위로 추가 분할
5. 각 청크에 파일명, 라인 범위 메타데이터 부착

**출력 타입:**

```tsx
interface DiffChunk {
  file: string;
  lineRange: [number, number];
  content: string;
  language: string;
  isLargeFile: boolean;
}
```

### Step 4: 리뷰어 프롬프트

**파일:** `prompts/reviewer-system.md`, `prompts/reviewer-user.md`, `src/reviewer/prompt.ts`

리뷰어 시스템 프롬프트 핵심:

- 역할 정의 (코드 리뷰어)
- 출력 포맷 가이드 (`[SEVERITY] category | line | title`)
- severity/category 정의 참조
- 리뷰 품질 기준

유저 프롬프트:

- 파일 경로 + diff 내용
- 프로젝트 컨텍스트 (선택적)

`prompt.ts`에서 프롬프트 파일을 로드하고 `{{DIFF}}`, `{{FILE}}` 등 플레이스홀더를 치환.

### Step 5: 리뷰어 병렬 실행

**파일:** `src/reviewer/executor.ts`, `src/reviewer/collector.ts`

**executor.ts 로직:**

1. config에서 `enabled: true`인 리뷰어 필터링
2. `max_parallel`로 동시 실행 수 제한
3. 각 리뷰어에 대해 bash 명령 생성:
    
    ```
    timeout {timeout} opencode run --model {provider}/{model} --format json "{prompt}" > /tmp/review_{name}.json &
    ```
    
4. 전체 bash 스크립트를 `/tmp/review_script.sh`에 저장
5. `child_process.execSync`로 실행
6. 종료 후 결과 파일 수집

**collector.ts 로직:**

1. `/tmp/review_{name}.json` 파일들 읽기
2. 파일 없음 = 해당 리뷰어 실패 (timeout 또는 에러)
3. 파일 있으나 비어있음 = 빈 응답 처리
4. 성공한 리뷰어 결과를 배열로 반환
5. 전체 실패 시 에러 반환

### Step 6: 응답 파서

**파일:** `src/parser/regex-parser.ts`, `src/parser/schema.ts`, `src/parser/transformer.ts`

**regex-parser.ts 핵심 정규식:**

```tsx
// 이슈 블록 분리
const ISSUE_BLOCK_REGEX = /\[(CRITICAL|MAJOR|MINOR|SUGGESTION)\]\s*(.+?)\s*\|\s*L?(\d+)(?:-(\d+))?\s*\|\s*(.+)/gi;

// confidence 추출
const CONFIDENCE_REGEX = /confidence:\s*(\d+\.?\d*)/i;
```

**변환 파이프라인:**

```
원문 텍스트
 → 이슈 블록 분리 (정규식)
 → 헤더 파싱 (severity, category, line, title)
 → 본문 파싱 (description, suggestion)
 → confidence 추출
 → zod 검증
 → 성공: ReviewIssue 객체 / 실패: parse_failed + 원문 보존
```

**테스트 케이스 (필수):**

- 정상 포맷 파싱
- confidence 누락 → 기본값 0.5
- severity 오타 → minor로 fallback
- 복수 이슈 블록 파싱
- 완전히 비구조적인 응답 → parse_failed
- 빈 응답 처리

### Step 7: 토론 진입 판정

**파일:** `src/debate/judge.ts`

**판정 로직:**

```tsx
function shouldDebate(reviews: ParsedReview[]): DebateDecision {
  // 1. 같은 라인 범위에 서로 다른 severity → conflict
  // 2. critical 이슈 1건 이상 → debate
  // 3. major 이상 + confidence < 0.7 → debate
  // 4. 3명 이상 같은 영역 지적 → debate
  // 모두 미충족 → skip
}
```

Phase 1에서는 판정만 하고 실제 토론은 실행하지 않음. 결과에 "토론 필요" 플래그만 표시.

### Step 8: 최종 종합 + 리포트

**파일:** `src/head/synthesizer.ts`, `src/head/reporter.ts`

**synthesizer.ts:**

- 모든 리뷰어의 이슈를 병합
- 중복 이슈 그룹핑 (같은 라인 범위 + 같은 category)
- severity 투표 (다수결)
- 토론 필요 여부 표시

**reporter.ts:**

- Markdown 리포트 생성
- 포함 내용: 요약, critical issues, 리뷰어별 결과, 메트릭 (시간, 비용, 토큰)
- 터미널에 출력 (chalk로 컬러링)

## 4.2 프롬프트 전략

### 리뷰어 프롬프트 설계 원칙

- **간결함**: 시스템 프롬프트 500토큰 이내
- **출력 구조 유도**: JSON 강제 아닌, 텍스트 포맷 예시 제공
- **역할 특화 없음**: 모든 리뷰어에게 동일 프롬프트 (모델 자체 특성에 의존)
- **컨텍스트**: 파일 경로, 프로젝트 언어, 프레임워크 정보 포함

### 프롬프트 버전 관리

- `prompts/` 디렉토리에 마크다운 파일로 관리
- 프롬프트 변경 시 커밋 메시지에 `prompt:` 접두사
- 향후 A/B 테스트를 위해 프롬프트 버전 태깅 고려

## 4.3 에러 핸들링 전략

**원칙: 최대한 진행, 최소한 실패**

- config 로딩 실패 → 종료 (복구 불가)
- diff 추출 실패 → 종료 (입력 없음)
- 개별 리뷰어 실패 → 스킵, 나머지로 진행
- 전체 리뷰어 실패 → 에러 메시지 출력 후 종료
- 파서 실패 → parse_failed 플래그, 원문 보존
- 리포트 생성 실패 → 원시 데이터라도 출력

## 4.4 개발 환경 요구사항

- Node.js 20+
- pnpm
- OpenCode CLI 설치 + provider API key 설정
- Git (diff 추출용)
- Claude Code (헤드 에이전트용, Phase 1에서는 선택적)