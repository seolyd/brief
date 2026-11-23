# Daily Brief

유튜브 대신 쓰는, **끝이 있는** 뉴스 앱. 아침 10분, 저녁 10분.

유튜브가 어려운 이유는 셋입니다. 시작과 끝이 없고, 정보와 오락의 경계가 없고, 내가 고르는 것
같지만 다음 행동은 추천 알고리즘이 정합니다. 이 앱은 그 반대로 만듭니다.

- **정해진 양.** 아침은 분야별 10개, 저녁은 GeekNews 5개와 심층 기사 1개. 다 읽으면 "여기까지"가 나오고 더 보여줄 것이 없습니다.
- **정해진 시간.** 10분 타이머가 끝나면 목록이 닫힙니다. 다 못 읽어도 괜찮습니다.
- **알고리즘 없음.** 내가 고른 출처(`sources.json`)만, 시간순으로.

## 화면

| 탭 | 하는 일 |
| --- | --- |
| 아침 · 저녁 | 같은 네 칸. **Biz.Brief** (사업 아이템·돈 버는 방법 긴 글) · **Biz.News** (해외 아이템·국내 창업·AI 헤드라인) · **All.Brief** (일반 뉴스 긴 글) · **All.News** (주요 일간지 헤드라인) |
| 듣기 | 팟캐스트, 쇼마다 최신 회차 하나. 앱 안에서 재생, 들은 위치 기억 |
| QT | 이달의 QT 항목을 골라 매일 아침 7시에 열리는 말씀·해석·묵상 질문을 읽고, 마음에 남은 말씀·나의 묵상·나의 다짐·기도를 기록 |

## 정보 구성

| 분야 | 소스 | 얻는 것 |
| --- | --- | --- |
| 해외 사업 아이템 (Biz) | Product Hunt, Show HN, TechCrunch Startups, Rest of World, Tech in Asia, Sifted, Entrepreneur, Inc., Fast Company, Trends.vc, Not Boring | 해외에서 뜨는 사업·서비스, 다른 나라 모델, 창업 사례 |
| 국내 창업·스타트업 (Biz) | 플래텀, 벤처스퀘어, 비석세스, 바이라인네트워크, 아웃스탠딩, 스타트업엔, 와우테일 | 국내 새 사업 모델, 창업 사례, 지원사업 |
| AI·테크 | GeekNews, Hacker News, TLDR, Ben's Bites, Stratechery, Platformer | AI로 만드는 사업, 신기술 |
| 한국 경제·산업 | 매경, 서울경제, 연합뉴스 | 국내 산업, 정책, 기업 |
| 글로벌 경제 | Bloomberg Economics, The Economist, Axios, Semafor | 세계 경제, 정책, 지정학 |
| 커리어·비즈니스 | Lenny's Newsletter, The Pragmatic Engineer | 조직관리, 리더십, 경영 |
| 주요 일간지 (All) | SBS 주요뉴스, 경향, 한겨레, 동아, 국민일보, 연합뉴스 정치·국제 | 정치, 사회, 국제, 생활 |

팟캐스트: My First Million, The Startup Ideas Podcast, How I Built This, Starter Story, Planet Money, The Daily, Hard Fork, 손에 잡히는 경제.

RSS가 러너에서 막혀 수집하지 못하는 Springwise·Trend Hunter·Exploding Topics·Indie Hackers·Starter Story는
`sources.json`의 `links`에 두고, Biz.Brief를 쓸 때 웹 검색으로 찾아봅니다.

Reuters는 RSS를 닫아서 수집하지 않습니다. 한경과 HBR은 GitHub 러너의
요청을 막아서 서울경제와 Lenny's Newsletter로 대신했습니다.

## 어떻게 도나

서버가 없습니다. GitHub Action(`.github/workflows/refresh.yml`)이 매일 한국 시간 06:30(아침판)과 18:30(저녁판)에

1. `npm run feed` — `sources.json`의 RSS를 모아 `public/data/feed.json`을 씁니다.
2. `npm run brief` — 저장소 Secret에 `ANTHROPIC_API_KEY`가 있으면 Claude가 최근 36시간 기사로
   "오늘 알아야 할 10가지"를 써서 `public/data/brief.json`에 둡니다. 키가 없으면 건너뛰고,
   앱은 헤드라인으로 대신 보여줍니다. 모델에는 기사 번호만 보내고 답도 번호로 받아,
   출처 주소를 모델이 지어낼 수 없게 했습니다.
3. 바뀐 파일을 커밋합니다. Vercel이 그 커밋을 배포합니다.

### Must Read (Biz.Brief · All.Brief)

06:41과 18:41에 **Claude 예약 작업**(claude.ai의 Claude Code 예약 작업)이 새 세션을 열고
[`docs/MUSTREAD.md`](docs/MUSTREAD.md)대로 씁니다. 방금 수집한 피드를 출발점으로 웹 검색으로 사실과 숫자를
확인하고, `scripts/save-mustread.mjs`로 형식을 검사한 뒤 `public/data/bizbrief-<판>.json`(Biz)과
`public/data/allbrief-<판>.json`(All)을 커밋합니다.
API 키가 필요 없고 Claude 구독 사용량을 씁니다. 독자 소개와 관심사는 `sources.json`의 `profile`에서,
글의 구조와 원칙은 `docs/MUSTREAD.md`에서 고칩니다.

### Daily QT

이달의 QT 항목(잠언 한 달, 시편, 산상수훈, 요한복음, 빌립보서·골로새서)마다 날짜별 본문이
`public/qt/plans.json`에 정해져 있고, 본문은 `public/bible/`의 개역한글(1961, 대한성서공회)입니다.
매일 아침 7시 전 Claude 예약 작업이 [`docs/QT.md`](docs/QT.md)대로 항목마다 해석·묵상 질문·기도를 써서
`public/data/qt/<날짜>.json`에 둡니다. 하루는 한국 시간 아침 7시에 바뀝니다.

읽음 표시, 타이머 기록, 고른 QT 항목과 QT 기록은 전부 이 기기의 localStorage에만 있습니다.

## 소스 고치기

`sources.json`에 한 줄 넣으면 됩니다. 넣기 전에 Actions 탭의 **Check feeds**로 주소가 열리는지,
최신 제목이 맞는 발행처인지 확인하세요. 팟캐스트 이름을 넣으면 피드 주소도 찾아 줍니다.
`deep: true`인 소스가 저녁의 '심층 기사 하나' 후보입니다.

## 개발

```bash
npm install
npm run dev
npm run feed     # 로컬에서 피드 수집
npm run build
```

## 배포

Vercel에 저장소를 연결하면 됩니다 (프리셋 Vite, 다른 설정 없음). 아이폰에서는 Safari로 열고
공유 → 홈 화면에 추가. 유튜브 앱이 있던 자리에 두세요.

## 재물

하단 **재물** 탭. 성경적 재물관 12가지 주제(청지기, 공급, 자족, 두 주인, 근면, 정직, 빚·보증, 저축·계획,
드림, 나눔, 투자·위험, 영원한 관점)로 묵상하고 상담합니다.

- **오늘 묵상** — 하루 한 주제씩 12일에 한 바퀴(첫날 2026-11-16 = 1번). 하루는 QT처럼 한국 시간 아침 7시에
  바뀝니다. 성경 본문 → 해석 → 삶의 적용 → 실천 과제 → 기도문, 그리고 나의 묵상·실천 기록(이 기기에만 저장).
- **12가지** — 주제 전체와 각 주제의 말씀.
- **재물 상담** — 내 생각이나 상황을 적으면 Claude가 12가지 기준 각각에 부합·주의·어긋남·해당 없음으로
  판단하고 조언·관련 말씀·돌아볼 질문·기도를 돌려줍니다.
  - Vercel 환경 변수에 `ANTHROPIC_API_KEY`와 `COUNSEL_PASSCODE`가 **둘 다** 있으면 앱 안에서 바로
    결과를 보여줍니다(`api/counsel.js`). 암호는 앱에서 한 번 입력합니다. 주소를 아는 다른 사람이 내 키로
    상담을 돌리지 못하게 하는 장치입니다.
  - 없으면 **Claude 앱에서 상담받기**로 동작합니다. 상담 요청문을 복사하고 Claude를 열어 주며, 받은 답을
    붙여 넣으면 기록에 남습니다. API 키 없이 Claude 구독으로 돌아갑니다.

본문은 `public/wealth/topics.json`. 주제와 해설은 `scripts/wealth-topics.mjs`에서 고치고,
`node scripts/build-wealth.mjs <korean-bible-1961-krv 폴더>`로 다시 만듭니다. 성경 본문은 손으로 옮기지 않고
개역한글(1961) 데이터에서 그대로 꺼내며, 해설 속 "…" 인용이 실제 본문에 있는지도 이때 검사합니다.

