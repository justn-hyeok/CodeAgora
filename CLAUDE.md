# Oh My CodeReview

## 프로젝트 개요
여러 LLM이 협력하여 코드를 심층 리뷰하는 CLI 파이프라인.
리뷰어 모델들이 병렬로 독립 리뷰 → 의견 충돌 시 토론 → 헤드 에이전트가 최종 판단.

## 기술 스택
- Runtime: Node.js + TypeScript
- CLI Framework: commander 또는 yargs
- Schema Validation: zod
- 리뷰어 실행: OpenCode CLI (bash 병렬)
- 오케스트레이션: Claude Code
- 테스트: vitest
- 빌드: tsup
- 패키지 매니저: pnpm

## 디렉토리 구조
oh-my-codereview/
├── src/
│   ├── cli/...timer.ts
├── prompts/                  # 프롬프트 템플릿
│   ├── reviewer-system.md    # 리뷰어 시스템 프롬프트
│   ├── reviewer-user.md      # 리뷰어 유저 프롬프트 (diff 삽입)
│   ├── head-system.md        # 헤드 시스템 프롬프트
│   └── debate-system.md      # 토론 시스템 프롬프트
├── tests/
│   ├── parser/
│   ├── config/
│   ├── diff/
│   └── fixtures/             # 테스트용 샘플 diff, 리뷰 응답
├── oh-my-codereview.config.json
├── .reviewignore
├── CLAUDE.md
├── package.json
└── tsconfig.json

## 개발 컨벤션

### 코드 스타일
- TypeScript strict mode
- 함수형 스타일 선호 (순수 함수, 불변 데이터)
- 에러 핸들링: try-catch 대신 Result 타입 패턴 (`{ success: true, data } | { success: false, error }`)
- 모든 외부 입력은 zod로 검증

### 커밋 컨벤션
- feat: 새 기능
- fix: 버그 수정
- refactor: 리팩토링
- test: 테스트 추가/수정
- docs: 문서 수정
- chore: 설정, 빌드 관련

### 테스트
- 파서: 다양한 리뷰어 응답 패턴에 대한 유닛 테스트 필수
- config: 유효/무효 config에 대한 검증 테스트
- 통합 테스트: 샘플 diff → 전체 파이프라인 실행

### 주요 명령어
- `pnpm dev` — 개발 모드 실행
- `pnpm build` — 프로덕션 빌드
- `pnpm test` — 테스트 실행
- `pnpm lint` — 린트 실행
- `pnpm review <path>` — 리뷰 파이프라인 실행

## 구현 시 주의사항

### config
- config 파일이 없으면 기본 config 생성 안내 출력
- enabled된 리뷰어가 min_reviewers 미만이면 경고 후 계속 진행
- provider/model 조합이 OpenCode에서 지원되는지 검증하지 않음 (런타임에 실패하면 스킵)

### 리뷰어 실행
- bash 스크립트를 /tmp에 생성 후 실행
- 각 리뷰어 출력은 /tmp/review_{name}.json에 저장
- timeout 초과 시 해당 리뷰어 스킵, 나머지로 진행
- 전체 리뷰어 실패 시 에러 메시지 출력 후 종료

### 파서
- 파싱 실패한 이슈는 버리지 않고 parse_failed: true로 보존
- confidence가 없으면 기본값 0.5
- severity가 인식 불가하면 "minor"로 기본값 처리

### 프롬프트
- 리뷰어 프롬프트에 JSON 포맷을 강제하지 않음
- 최소 텍스트 구조만 요구: [SEVERITY] category | line | title
- 프롬프트 파일은 prompts/ 디렉토리에 마크다운으로 관리
- diff는 프롬프트의 {{DIFF}} 플레이스홀더에 삽입

## 참고 문서
1. [PRD](docs/1_PRD.md)
2. [PHASE_PLAN](docs/2_PHASE_PLAN.md)
3. [IMPLEMENT_PLAN](docs/4_IMPLEMENT_PLAN.md)