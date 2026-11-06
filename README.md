# Daily Brief

유튜브 대신 쓰는, **끝이 있는** 뉴스 앱. 아침 10분, 저녁 10분.

유튜브가 어려운 이유는 셋입니다. 시작과 끝이 없고, 정보와 오락의 경계가 없고, 내가 고르는 것
같지만 다음 행동은 추천 알고리즘이 정합니다. 이 앱은 그 반대로 만듭니다.

- **정해진 양.** 아침은 분야별 10개, 저녁은 GeekNews 5개와 심층 기사 1개. 다 읽으면 "여기까지"가 나오고 더 보여줄 것이 없습니다.
- **정해진 시간.** 10분 타이머가 끝나면 목록이 닫힙니다. 다 못 읽어도 괜찮습니다.
- **알고리즘 없음.** 내가 고른 출처(`sources.json`)만, 시간순으로.
- **영상은 나중에.** 궁금한 영상은 바로 보지 않고 '나중에'에 주소만 넣습니다.

## 화면

| 탭 | 하는 일 |
| --- | --- |
| 아침 | Morning Intelligence Brief — 오늘 알아야 할 10가지 (핵심 · 왜 중요한가 · 앞으로). 브리핑이 없으면 분야별 헤드라인 10개 |
| 저녁 | GeekNews 5개 + 심층 기사 1개 |
| 듣기 | 팟캐스트, 쇼마다 최신 회차 하나. 앱 안에서 재생, 들은 위치 기억 |
| 나중에 | 바로 보지 않을 영상·글 목록. 비우는 곳 |
| 습관 | 지난 7일 사용 시간, 유튜브 접근 방식 바꾸기 체크리스트 |

## 정보 구성

| 분야 | 소스 | 얻는 것 |
| --- | --- | --- |
| 글로벌 경제 | Bloomberg, The Economist, Axios, Semafor | 미국 경제, 금리, 환율, 지정학 |
| 미국 증시 | Bloomberg Markets, CNBC | 나스닥, 빅테크, ETF |
| AI·테크 | GeekNews, Hacker News, TLDR, Stratechery, Platformer | AI 산업 변화, 신기술 |
| 한국 경제·산업 | 한경, 매경, 연합뉴스, 어피티 | 국내 산업, 정책, 기업 |
| 커리어·비즈니스 | HBR, The Pragmatic Engineer | 조직관리, 리더십, 경영 |

Reuters는 RSS를 닫아서 수집하지 않고, '습관' 탭에 바로가기로 둡니다.

## 어떻게 도나

서버가 없습니다. GitHub Action(`.github/workflows/refresh.yml`)이 매일 한국 시간 06:30에

1. `npm run feed` — `sources.json`의 RSS를 모아 `public/data/feed.json`을 씁니다.
2. `npm run brief` — 저장소 Secret에 `ANTHROPIC_API_KEY`가 있으면 Claude가 최근 36시간 기사로
   "오늘 알아야 할 10가지"를 써서 `public/data/brief.json`에 둡니다. 키가 없으면 건너뛰고,
   앱은 헤드라인으로 대신 보여줍니다. 모델에는 기사 번호만 보내고 답도 번호로 받아,
   출처 주소를 모델이 지어낼 수 없게 했습니다.
3. 바뀐 파일을 커밋합니다. Vercel이 그 커밋을 배포합니다.

읽음 표시, 타이머 기록, '나중에' 목록은 전부 이 기기의 localStorage에만 있습니다.

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
