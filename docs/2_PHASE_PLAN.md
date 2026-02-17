# 2. 페이즈 계획

## Phase 1: Core Pipeline (MVP)

**목표:** 로컬에서 CLI로 실행 가능한 코드 리뷰 파이프라인

**기간:** 2~3주

### 1-1. 프로젝트 초기 설정 (2일)

- 프로젝트 디렉토리 구조 생성
- package.json + TypeScript 설정
- [CLAUDE.md](http://CLAUDE.md) 작성
- config 스키마 정의 (zod)
- 기본 CLI 엔트리포인트

### 1-2. Config 시스템 (2일)

- `codeagora.config.json` 로더 구현
- zod 스키마 검증
- config validation (min_reviewers 체크 등)
- 기본 config 파일 생성기

### 1-3. Diff 추출 및 분할 (3일)

- Git diff 추출 (`git diff` 명령 실행)
- 파일 단위 분할
- 대형 파일 분할 (함수/컴포넌트 단위)
- `.reviewignore` 처리
- 컨텍스트 윈도우 맞춤 트리밍

### 1-4. 리뷰어 병렬 실행 (3일)

- config에서 enabled 리뷰어 추출
- bash 스크립트 동적 생성
- OpenCode CLI 병렬 호출 (`&` + `wait`)
- timeout 처리
- 결과 JSON 파일 수집

### 1-5. 응답 파서 (3일)

- JS 정규식 파서 구현 (`[SEVERITY] category | line | title` 패턴)
- 필드별 추출 (severity, category, line_range, title, description, suggestion, confidence)
- zod 스키마 검증
- parse_failed 처리 (원문 보존)
- 파서 유닛 테스트

### 1-6. 토론 진입 판정 (2일)

- 충돌 감지 (같은 라인 범위, 다른 의견)
- Critical 이슈 감지
- 낮은 확신도 감지
- 다수 지적 감지
- 판정 결과 구조화

### 1-7. 최종 종합 + 리포트 (2일)

- Claude Code가 리뷰어 결과 + 토론 판정 결과를 종합
- Markdown 리포트 생성
- 터미널 출력
- 비용/시간 메트릭 집계

**Phase 1 산출물:**

- CLI 명령어: `npx codeagora ./path/to/diff` 또는 `npx codeagora --pr 142`
- 터미널에 Markdown 리포트 출력
- 로컬에서 완전히 동작하는 파이프라인

## Phase 2: 토론 엔진 + GitHub 통합

**목표:** 조건부 토론 실행 + PR에 자동 코멘트

**기간:** 2~3주

### 2-1. 토론 엔진 (4일)

- 토론 대상 이슈 선정
- 리뷰어에게 상대 의견 전달 (재호출)
- 라운드 관리 (최대 3라운드)
- 합의 판정 (강한 합의 / 다수 합의 / 합의 실패)
- 토론 로그 구조화

### 2-2. Codex 서포터 (3일)

- 코드 실행 환경 구성 (lint, 타입체크)
- 리뷰어가 지적한 이슈를 코드 실행으로 검증
- 검증 결과를 토론에 반영

### 2-3. GitHub PR 통합 (3일)

- GitHub API로 PR diff 자동 추출
- inline comment 게시
- `<details>` 접힌 리뷰어별 의견
- PR description에 요약 코멘트

### 2-4. GitHub Action (2일)

- `.github/workflows/review.yml` 작성
- PR opened / synchronize 트리거
- `/review` 커맨드 트리거
- review:skip 라벨 처리

**Phase 2 산출물:**

- PR 올리면 자동으로 리뷰 코멘트가 달리는 파이프라인
- 의견 충돌 시 자동 토론 진행

## Phase 3: Discord 연동 + 인간 인터랙션

**목표:** 실시간 토론 시각화 + 인간 개입 채널

**기간:** 2주

### 3-1. Discord Bot/Webhook 연동 (3일)

- PR별 스레드 자동 생성
- 에이전트별 웹훅 (이름 + 아바타)
- 토론 과정 실시간 게시
- 2000자 초과 처리

### 3-2. 인간 인터랙션 (3일)

- `!dismiss`, `!approve`, `!escalate`, `!retry`, `!stop` 명령어
- `@here` / `@인간` 멘션 트리거
- 인간 응답 반영 로직

### 3-3. 피드백 수집 (2일)

- 👍/👎/🤔 리액션 수집
- 에이전트별 정확도 점수 축적
- SQLite 또는 JSON 파일 저장

**Phase 3 산출물:**

- Discord에서 실시간 토론 과정 확인 가능
- 인간이 Discord에서 파이프라인에 개입 가능

## Phase 4: 최적화 + 확장

**목표:** 피드백 기반 개선 + 고급 기능

**기간:** 지속적

- 피드백 기반 에이전트 가중치 조정
- PR 특성별 리뷰어 자동 선택
- 프로젝트별 커스텀 리뷰 규칙 (FSD 검증 등)
- 리뷰 대시보드
- 보안 전처리 레이어
- 프롬프트 자동 개선