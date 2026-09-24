# Google Drive 전환 검증 결과

검증일: 2026-09-24. 실제 Edge 브라우저, 원본 MP3, Google 응답을 모의한 통합 환경을 사용했습니다.

## 보존과 백업

- J:의 기존 앱을 변경 전에 별도 폴더로 전체 백업.
- 기존 앱과 작업본의 src/public 해시 일치 확인 후 수정.
- 기존 CSS, 표지 SVG 33개, 웰컴/책장/카드/미니·전체 플레이어 레이아웃 보존.
- HTML은 경로, 설정 로드, 저장/접근 안내 문구만 변경. 원본 MP3 변경/재업로드 없음.

## 자동 테스트 — 12건 통과

- 구간 중복 제거, 90% 완료, 탐색만으로 완료되지 않음, 기록 병합/시간 표시.
- Drive MIME 필터, 숫자 정렬, 파일 ID 안정성, 실제 목록에 없는 책 미생성.
- 계정별 localStorage 격리, 재접속 읽기, 손상 데이터 복구.
- Service Worker에서 Authorization + Range → files.get alt=media 전달.
- 부분 응답의 Content-Range 및 no-store 처리.
- 전체 body 완료 이전의 스트리밍 응답 반환.
- 세션 밖 파일/클라이언트 없는 요청 차단, 잘못된 Range 거부, 401 만료 전달.

## 실제 브라우저 확인

- 원본 MP3 33개를 로컬 경로에서 직접 읽어 기존 기능 검증. 음원 복사 단계 없음.
- 재생·일시정지, seek, ±10초, 다른 책 전환, 이전·다음, 이어듣기, 즐겨찾기, 검색/필터, 로그아웃 확인.
- 375×812, 430×932, 768×1024, 1366×768, 1920×1080: 가로 넘침 없음.
- Google 응답을 모의한 통합 테스트: 폴더 접근 확인 → 2페이지 파일 조회 → 실제 MP3를 인증 Range 스트리밍으로 재생.
- 모의한 403: 책 목록/음원 요청 없이 거부 화면. 401: 재로그인 안내 및 목록 제거, 로컬 기록 보존.
- 계정/토큰을 localStorage나 음원 URL에 저장하지 않음. CacheStorage에 Drive 요청/음원 없음.
- GitHub Pages와 동일한 `/science-library/` 하위 경로에서 표지·스타일·manifest·Service Worker 정상 동작.
- 테스트 중 JavaScript pageerror 0건.
- Service Worker 차단 및 스트림 비호환 상황에서 인증된 Blob 재생으로 자동 전환 확인.
- npm audit: 전체 설치 의존성 취약점 0건. Firebase SDK/Admin/CLI 의존성 제거.

## 검증의 한계

실제 Google OAuth Client ID와 Drive 폴더 ID는 아직 제공되지 않았습니다. 따라서 실계정 OAuth 동의 화면, 실제 Drive 공유 권한, Google 서버의 실전 Range/CORS 응답과 다운로드 할당량, 실제 GitHub Pages URL 배포는 완료했다고 주장하지 않습니다. API 모의 테스트는 실서비스 연결 검증을 대신하지 않습니다.

화면 크기는 Edge viewport로 검증했습니다. 실제 iPhone Safari/Android 기기의 잠금 화면, 백그라운드 재생, 홈 화면 설치, 네트워크별 시작 지연은 설정·배포 후 확인해야 합니다. 스트리밍 미지원 환경은 인증 Blob 다운로드로 대체합니다.

## 증거 파일

- `test-results/browser-results.json`: 기존 로컬 기능 회귀 결과.
- `test-results/drive/results.json`: 모의 Google 통합 결과.
- `test-results/drive/*.png`: 모바일/데스크톱 화면.

이 개인 테스트 자료는 GitHub 배포 ZIP/저장소에서 제외합니다. 소스의 테스트 파일로 재실행할 수 있습니다.
