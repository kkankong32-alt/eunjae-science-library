# 은재의 Dr. Seuss Science Library

기존 디자인과 플레이어를 유지한 Google Drive 버전입니다.

**정적 웹앱 → Google 로그인 → Drive API → 원래 폴더의 MP3**

Firebase, 서버 데이터베이스, 음원 재업로드가 필요 없습니다. 표지만 웹앱에 포함하고, 음원은 Google Drive의 원래 위치에 둡니다. 현재 Client ID와 폴더 ID는 빈 설정값이므로 실제 계정 연결과 공개 URL 배포는 아직 하지 않았습니다.

## 직접 할 일 — 5단계

### 1. Google Cloud에서 Drive API와 동의 화면 준비

- [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들거나 선택합니다.
- **API 및 서비스 → 라이브러리 → Google Drive API → 사용**을 누릅니다.
- **Google Auth Platform**에서 앱 이름을 `은재의 Dr. Seuss Science Library`로 설정하고 본인의 지원 이메일을 입력합니다.
- Audience는 개인 Gmail 계정을 쓰면 External로 설정합니다. 가족용 초기 사용은 **Testing**으로 두고, Test users에 **은재 계정과 사용할 부모 계정만** 추가합니다.
- Data Access에는 `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.readonly`를 설정합니다. 메뉴 이름은 Console 언어에 따라 달라질 수 있습니다.

기존 폴더의 모든 MP3를 ID 하나로 자동 조회하려면 `drive.readonly`가 필요합니다. 이 OAuth 권한은 **지정 폴더에만 제한된 권한이 아니라 그 계정이 접근할 수 있는 Drive 파일의 읽기 권한**입니다. 앱 코드는 지정 폴더와 그 안의 MP3만 요청하고, 쓰기·삭제 권한은 요청하지 않습니다. `drive.file`은 앱이 선택/생성한 개별 파일용이므로 이 구조의 단순 대체재가 아닙니다. 공개 서비스로 전환할 경우 restricted scope 검증 조건을 별도로 확인하세요. [Google 공식 권한 안내](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

### 2. OAuth Client ID 만들기

- Clients → Create client → **Web application**을 선택합니다.
- **Authorized JavaScript origins**에 사용할 사이트의 출처를 추가합니다. GitHub Pages라면 `https://본인아이디.github.io`입니다. `/저장소이름/` 경로는 넣지 않습니다.
- 로컬에서 실제 로그인을 시험하려면 `http://127.0.0.1:4173`도 추가합니다. 테스트 서버를 4174로 실행하면 `http://127.0.0.1:4174`도 별도로 등록합니다.
- `.apps.googleusercontent.com`으로 끝나는 **Client ID**를 복사합니다. Client secret은 사용하지 않고 소스에 넣지 않습니다.
- 팝업 토큰 방식을 쓰므로 앱 자체의 redirect URL 설정은 필요 없습니다.

### 3. 설정 파일에 두 값 입력

`public/config.js`를 열어 다음 두 값을 바꿉니다.

```javascript
window.LIBRARY_CONFIG = Object.freeze({
  GOOGLE_CLIENT_ID: '발급받은값.apps.googleusercontent.com',
  GOOGLE_DRIVE_FOLDER_ID: '폴더_ID',
  ALLOWED_EMAILS: [],
  PARENT_EMAILS: []
});
```

Google Drive **웹**에서 `Dr.Seuss Science` 폴더를 열어 주소를 봅니다.

`https://drive.google.com/drive/folders/XXXXXXXXXXXX`이면 폴더 ID는 `XXXXXXXXXXXX`입니다. Windows의 `J:` 경로를 입력하지 않습니다.

선택 사항으로 `ALLOWED_EMAILS: ['은재이메일', '부모이메일']`, `PARENT_EMAILS: ['부모이메일']`을 넣을 수 있습니다. 이메일 목록은 추가 화면 확인 용도이며, 실제 음원 보안은 다음 단계의 **Drive 공유 권한**이 강제합니다. 이메일을 넣는 것만으로 Drive 접근 권한이 생기지 않습니다.

### 4. 원래 Drive 폴더를 은재·부모에게만 공유

- 원래 `Dr.Seuss Science` 폴더 → 공유 → 일반 액세스: **제한됨**.
- 은재 계정과 필요한 부모 계정만 추가합니다. 재생에는 뷰어 권한이면 충분합니다. 소유자 계정은 계속 접근할 수 있습니다.
- 상위 폴더에서 상속된 공유나 각 파일에 별도로 추가된 공유가 있다면, 가족 외 계정이 접근하지 않는지 확인합니다.
- 뷰어의 다운로드가 차단되어 있으면 API 음원 재생도 막힙니다. 해당 파일을 읽고 다운로드할 수 있는 권한을 허용하세요.
- MP3는 이동하거나 다시 업로드하지 않습니다. 앱/표지 폴더는 MP3로 취급하지 않으며, 지정 폴더의 **바로 안쪽** `audio/mpeg` 파일만 조회합니다. 하위 폴더나 바로가기는 재귀 탐색하지 않습니다.

### 5. GitHub Pages 배포

- 제공된 **Drive 버전 소스 ZIP**을 풀어 **그 안의 앱 소스만** GitHub 저장소의 루트에 올립니다. 원본 Drive 폴더 전체를 올리지 않습니다. `.github/workflows/pages.yml`도 포함해야 합니다.
- 저장소의 기본 브랜치는 `main`으로 둡니다.
- GitHub 저장소 → Settings → Pages → Source: **GitHub Actions**를 선택합니다.
- `main`에 코드를 올리면 준비된 workflow가 설치·테스트·빌드·Pages 배포를 실행합니다. Actions의 작업이 초록색으로 끝나면 Pages에서 URL을 엽니다.
- 은재 계정으로 로그인해서 첫 재생을 확인합니다. 홈 화면 설치는 iPhone Safari의 **공유 → 홈 화면에 추가**, Android Chrome의 **메뉴 → 앱 설치**를 사용합니다.

일반적인 주소는 `https://본인아이디.github.io/저장소이름/`입니다. 이 하위 경로에 맞춰 아이콘, 표지, 로그인 스크립트, Service Worker, manifest를 모두 상대경로로 만들었습니다. GitHub 계정 플랜에 따라 Private 저장소의 Pages 지원 여부가 다를 수 있습니다. 공개 저장소를 사용해도 **이 소스 ZIP에는 MP3가 없으며 Drive 권한은 별개**입니다. 표지와 표지 연결용 제목 정보는 공개될 수 있습니다.

다른 정적 호스팅을 쓰면 `npm ci` → `npm run build` 후 생성된 `dist`의 내용만 HTTPS로 배포하고, 그 사이트의 출처를 2번에 추가합니다. API 서버나 음원 저장소를 새로 만들 필요가 없습니다.

## 컴퓨터에서 확인하기

Node.js 22 이상을 설치하고, 이 README가 있는 앱 폴더에서 PowerShell을 열어 실행합니다.

```powershell
npm.cmd ci
npm.cmd start
```

`http://127.0.0.1:4173`을 열면 기존 로컬 체험을 사용할 수 있습니다. 개발 서버는 원래 MP3 파일을 직접 읽으며 복사하지 않습니다. `.private/library.json`은 개발용 원본 경로 연결 정보이고 배포/Git에서 제외됩니다. 소스 ZIP에는 이 개인 경로 정보도 없습니다. 새 컴퓨터에서 로컬 체험이 필요하면 아래 명령으로 실제 원본 폴더를 한 번 조사합니다.

```powershell
node scripts/scan-library.mjs "J:\내 드라이브\남치USB\01. 개인\Dr.Seuss Science"
```

실제 Google Drive 연결을 로컬에서 시험할 때는 실행 중인 서버를 Ctrl+C로 종료하고 다음을 실행합니다.

```powershell
node scripts/dev-server.mjs --production
```

이 모드에는 체험 버튼/로컬 음원 경로가 없으며, 위의 두 설정값과 OAuth origin이 필요합니다. Node는 로컬 미리보기/빌드에만 사용하고, 배포한 앱은 정적 파일로 동작합니다.

## 재생과 보안 동작

- Google Identity Services의 토큰 모델을 사용합니다. 토큰은 페이지와 해당 페이지의 Service Worker 메모리에만 존재합니다. localStorage/IndexedDB/CacheStorage/URL에 저장하지 않습니다.
- 로그인 후 `files.get`으로 폴더 접근 가능 여부를 먼저 확인합니다. 단순 `files.list`의 빈 결과를 로그인 성공으로 간주하지 않습니다.
- 목록은 `files.list`의 모든 페이지를 조회합니다. `id`, `name`, `mimeType`, `size`, `modifiedTime`, 다운로드 가능 여부를 읽어 번호 순으로 정렬합니다. 책 개수나 file ID를 하드코딩하지 않습니다.
- 재생은 브라우저의 Range 요청을 Service Worker가 받아 **Authorization: Bearer**와 함께 `files.get?alt=media`로 전달합니다. 응답 body를 그대로 스트리밍하여 전체 다운로드 완료를 기다리지 않습니다. 토큰을 audio src나 공유 링크에 붙이지 않습니다. [Drive 부분 다운로드 공식 문서](https://developers.google.com/workspace/drive/api/guides/manage-downloads#partial_download)
- Service Worker를 사용할 수 없거나 해당 브라우저의 미디어 스트리밍이 실패하면, 동일한 인증 API로 Blob을 받은 뒤 재생하는 호환 경로를 사용합니다. 이 경우에는 파일 다운로드를 기다립니다. 실제 iPhone의 재생 시작 속도는 배포 후 확인해야 합니다.
- 재생/일시정지, 이전·다음, ±10초, 진행바, 이어듣기, Media Session은 그대로입니다. 새 책 선택/로그아웃은 이전 요청을 중단하고 메모리 URL을 해제합니다.
- 토큰 만료 또는 401 응답 시 재생을 정리하고 재로그인을 안내합니다. 기록은 남으므로 다음 로그인 후 이어 들을 수 있습니다. 정적 앱은 장기 refresh token을 보관하지 않으며 새로고침 후에도 로그인 버튼을 다시 누릅니다. [GIS 토큰 만료 안내](https://developers.google.com/identity/oauth2/web/guides/use-token-model#token_expiration)
- Drive 403/404는 접근 거부, 다운로드 할당량 제한은 잠시 후 다시 시도 안내로 처리합니다. 익명·미공유 사용자에게 앱이 음원 권한을 부여하지 않습니다.
- Service Worker는 앱 shell만 캐시합니다. 음원과 Drive API 응답은 캐시하지 않고 오프라인 MP3 다운로드 기능도 없습니다. 이미 기기에 전송된 음원을 원격 회수하는 DRM은 아닙니다.

## 기록과 표지

학습 기록은 `eunjae-progress:Google사용자ID` 키 아래 **Drive fileId**별로 저장합니다. 파일의 이름이나 정렬 순서를 바꿔도 fileId가 같으면 기록이 유지됩니다. 파일을 지우고 새로 업로드하면 새 ID이므로 별도 책으로 취급합니다. 계정별 데이터는 분리하며 다른 기기와 자동 동기화하지 않습니다.

재생 위치, 실제 청취 구간, 최근 날짜, 완료, 즐겨찾기를 보관합니다. 기존 90% 실제 청취 판정과 저장 시점은 유지했습니다. 브라우저 데이터 삭제, 다른 브라우저, 다른 사이트 주소에는 기록이 이어지지 않습니다. 종전 Firebase UID로 저장한 기록은 새 Google ID와 자동 연결하지 않습니다. 원래 데이터는 삭제하지 않았습니다. `src/progress.js`의 저장소 어댑터를 분리해 후속 동기화 추가가 가능하게 했습니다.

`public/covers`의 기존 SVG 33개는 내용 변경 없이 포함했습니다. `public/data/cover-catalog.json`은 기존 파일명에 맞는 표지·표시 제목·길이를 연결하는 보조 자료입니다. 이 목록이 Drive에 없는 책을 만들어 내지는 않습니다. 나중에 추가되는 MP3는 실제 Drive 목록에서 자동 표시하고, 기존 표지 연결이 없으면 공통 discovery 표지를 사용합니다. 파일 길이는 재생 시 브라우저 정보로 갱신합니다.

## 코드와 백업

```text
public/config.js             직접 입력할 Client ID, 폴더 ID
public/covers/               기존 SVG 표지 (배포 포함)
public/data/cover-catalog.json  표지 연결용 보조 정보
src/google-auth.js           Google 로그인·메모리 토큰
src/drive.js                 폴더 권한 확인·파일 목록·다운로드
src/media-bridge.js          페이지와 Service Worker 연결
public/service-worker.js     인증된 Range 스트리밍·앱 shell 캐시
src/player.js                기존 플레이어 기능
src/progress.js              localStorage 저장소 어댑터
.github/workflows/pages.yml  GitHub Pages 자동 배포
dist/                       음원 없는 배포 결과
```

기존 앱 전체는 원본 폴더의 `eunjae-science-webapp-backup-before-drive`에 보존했습니다. 별도의 변경 전 소스 ZIP도 제공합니다. 백업은 실행 중인 새 프로젝트나 GitHub 저장소에 넣지 않습니다. 원래 MP3는 그대로이며 새 프로젝트 내부의 과거 준비용 음원 복사본은 백업 쪽에만 보존합니다.

## 검증

`npm test`는 구간/정렬/로컬 기록/인증 Range 처리 테스트를 실행합니다. 실제 원본을 사용하는 기존 브라우저 검증은 `npm run test:browser`입니다. Drive 통합 테스트는 **Google 응답만 모의하고 실제 MP3를 사용**하며, `scripts/drive-browser-qa.mjs`에 있습니다. 상세 범위와 실계정에서 남은 확인은 `TEST-REPORT.md`를 참고하세요.
