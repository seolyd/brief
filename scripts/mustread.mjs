/**
 * Must Read — 하루 두 번(아침·저녁) 쓰는 긴 브리핑.
 *
 *   node scripts/mustread.mjs morning
 *   node scripts/mustread.mjs evening
 *
 * 수집한 피드(data/feed.json)를 출발점으로 Claude가 웹 검색으로 사실을 확인하며 긴 글을 씁니다.
 * 결과는 마크다운 한 편으로 public/data/mustread-<edition>.json에 들어갑니다.
 *
 * 링크는 지어낼 수 없게 합니다. 글 속 링크 주소가 이번 실행에서 실제로 본 주소(피드 기사,
 * 검색 결과, 열어 본 페이지)에 없으면 링크를 벗기고 글자만 남깁니다.
 *
 * ANTHROPIC_API_KEY가 없거나 실패하면 아무것도 바꾸지 않고 끝납니다. 피드 갱신은 막지 않습니다.
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'node:fs'

const edition = process.argv[2] === 'evening' ? 'evening' : 'morning'
const FEED_PATH = process.env.FEED_OUT ?? 'public/data/feed.json'
const OUT_PATH = `public/data/mustread-${edition}.json`
const WINDOW_HOURS = 24
const PER_DOMAIN = 25
const MAX_CONTINUES = 6

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('ANTHROPIC_API_KEY가 없어 Must Read를 건너뜁니다.')
  process.exit(0)
}

const feed = JSON.parse(readFileSync(FEED_PATH, 'utf8'))
const profile = JSON.parse(readFileSync('sources.json', 'utf8')).profile ?? {}
const domainLabel = Object.fromEntries((feed.domains ?? []).map((d) => [d.id, d.label]))
const since = Date.now() - WINDOW_HOURS * 3_600_000

const pool = []
for (const d of feed.domains ?? []) {
  pool.push(
    ...feed.items
      .filter((i) => i.domain === d.id && i.kind === 'article' && Date.parse(i.publishedAt) >= since)
      .slice(0, PER_DOMAIN),
  )
}
const listing = pool
  .map((i) => `- (${domainLabel[i.domain] ?? i.domain} · ${i.sourceName}) ${i.title}\n  ${i.url}${i.excerpt ? `\n  ${i.excerpt}` : ''}`)
  .join('\n')

// 한국 시간 기준 날짜 줄. 모델이 날짜를 추측하지 않게 스크립트가 정해 줍니다.
const kstDate = new Date().toLocaleDateString('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const dateLine = `${kstDate} · 한국시간 ${edition === 'morning' ? '오전' : '저녁'} 기준`

const STRUCTURE = {
  morning: `# 📰 Morning Intelligence Brief

${dateLine}

(도입 2~3문단: 오늘 브리핑의 핵심과, 지난 하루 시장·세상을 움직인 사건이 왜 함께 봐야 하는 일인지)

## 오늘의 핵심 3가지
(시장 / 한국 / 경제 같은 짧은 라벨과 한 줄 요약 셋. "- **시장** 한 줄" 형식)

## 1. 글로벌 경제 및 미국 증시
### ① …  (항목마다: 사실 → 표나 목록으로 숫자 → **해석:** → 출처)
## 2. AI & Technology
## 3. 한국 경제·산업
## 4. 국제 정세 및 에너지 (그날 중요한 이슈가 있을 때만)
## 5. 다음 주(또는 이번 주) 반드시 체크할 일정
(| 일정 | 중요 내용 | 시장 영향 | 표)
## 6. 투자 관점에서 오늘의 결론
(지켜보는 종목 표: | 종목 | 현재 주목할 변수 | 판단 | — 판단은 매매 신호가 아니라 뉴스 기반 위험 평가로 한 줄)
(다음 투자 판단을 위한 체크리스트 4~6개)
## 오늘 기억할 3가지
(01 / 02 / 03 — 각각 굵은 한 문장과 설명 한두 문장)

---
정보 기준: (무엇을 기준으로 썼고 무엇은 확인하지 못했는지)

**오늘의 한 문장:** …`,
  evening: `# 🌙 Evening Intelligence Brief

${dateLine}

(도입 2문단: 오늘 하루를 정리하면 무엇이 달라졌는가)

## 오늘의 핵심 3가지
(- **라벨** 한 줄 요약, 셋)

## 1. 오늘 한국 시장 마감
### ① …  (코스피·코스닥, 반도체, 외국인 수급. 숫자는 표로, **해석:** 포함)
## 2. 오늘 나온 중요한 뉴스
(글로벌 경제·정책, AI & Technology, 기업 — 항목마다 사실 → 왜 중요한가 → 출처)
## 3. 커리어 & 비즈니스
(테크 업계 채용·조직·리더십 흐름 1~2개)
## 4. 오늘 밤 미국 시장 관전 포인트
(| 시간(한국) | 이벤트 | 볼 것 | 표, 그리고 지켜보는 종목별 한 줄)
## 5. 내일 아침 확인할 것
(체크리스트 3~5개)

---
정보 기준: (무엇을 기준으로 썼고 무엇은 확인하지 못했는지)

**오늘의 한 문장:** …`,
}

const system = `당신은 한 사람을 위한 개인 인텔리전스 브리핑 편집자입니다. 독자가 유튜브 대신 이 글 한 편으로 세상을 파악하게 하는 것이 목표입니다.

독자: ${profile.reader ?? '한국에 사는 테크 업계 직장인'}
관심사: ${(profile.interests ?? []).join(', ')}
지켜보는 종목: ${(profile.watchlist ?? []).join(', ')}

쓰는 원칙:
- 숫자(지수, 등락률, 지표, 금액)는 웹 검색이나 웹 페이지에서 확인한 것만 씁니다. 확인하지 못한 숫자는 쓰지 않고, 필요하면 "확인하지 못했다"고 적습니다.
- 사실과 해석을 구분합니다. 해석은 "**해석:**" 또는 "**제 판단:**"으로 시작하는 문단에만 씁니다.
- 항목마다 끝에 출처를 마크다운 링크로 붙입니다. 예: 출처: [Reuters – 기사 제목](https://...). 링크 주소는 이번에 검색하거나 열어 본 페이지, 또는 아래 기사 목록에 있는 주소만 씁니다.
- 투자 권유를 하지 않습니다. 종목 판단은 매매 신호가 아니라 뉴스에 근거한 위험 평가로 씁니다. 최신 가격을 확인하지 않았다면 그렇게 밝힙니다.
- 자극적인 표현, 과장, 공포를 부추기는 말을 쓰지 않습니다. 차분하고 명료한 한국어 평서문으로 씁니다.
- 분량은 한국어로 6,000~9,000자. 항목은 7~10개.
- 마크다운만 씁니다. HTML 태그는 쓰지 않습니다.`

const user = `오늘의 ${edition === 'morning' ? '아침' : '저녁'} Must Read를 써 주세요.

아래는 지난 ${WINDOW_HOURS}시간 동안 수집한 기사 목록입니다. 출발점으로 쓰되, 중요한 사안은 웹 검색으로 최신 사실과 숫자를 확인하세요.
목록에 없어도 독자의 관심사에서 오늘 꼭 알아야 할 일이 있으면 검색해서 넣으세요.

${listing || '(수집된 기사가 없습니다. 검색으로 찾아 주세요.)'}

글은 다음 구조를 따르세요. 괄호 안은 설명이니 그대로 옮기지 마세요. 날짜 줄은 그대로 쓰세요.

${STRUCTURE[edition]}

글 본문만 출력하세요. 앞뒤에 설명을 붙이지 마세요.`

const client = new Anthropic()
const messages = [{ role: 'user', content: user }]
const responses = []

try {
  for (let turn = 0; turn <= MAX_CONTINUES; turn++) {
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      // 안전 분류기가 거절하면 서버가 알맞은 모델로 다시 돌립니다.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      system,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 15 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
      ],
      messages,
    })
    const msg = await stream.finalMessage()
    responses.push(msg)
    // 서버 도구가 오래 돌면 중간에 멈춥니다. 받은 그대로 돌려보내면 이어서 씁니다.
    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content })
      continue
    }
    break
  }
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) console.error('API 키가 유효하지 않습니다.')
  else if (err instanceof Anthropic.RateLimitError) console.error('요청 한도에 걸렸습니다. 다음 실행에 다시 돕니다.')
  else if (err instanceof Anthropic.APIError) console.error(`API 오류 ${err.status}: ${err.message}`)
  else console.error(err)
  process.exit(0)
}

const last = responses.at(-1)
if (!last || last.stop_reason === 'refusal' || last.stop_reason === 'pause_turn') {
  console.error(`Must Read를 만들지 못했습니다 (stop_reason: ${last?.stop_reason}).`)
  process.exit(0)
}

// 이번 실행에서 실제로 본 주소들. 이 밖의 링크는 글자만 남깁니다.
const seen = new Set(pool.map((i) => i.url))
const blocks = responses.flatMap((r) => r.content)
for (const b of blocks) {
  if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
    for (const r of b.content) if (r.url) seen.add(r.url)
  }
  if (b.type === 'web_fetch_tool_result' && b.content?.url) seen.add(b.content.url)
  if (b.type === 'text') for (const c of b.citations ?? []) if (c.url) seen.add(c.url)
}
const norm = (u) => u.replace(/[#?].*$/, '').replace(/\/$/, '')
const seenNorm = new Set([...seen].map(norm))

// 도구 호출 사이에 쓴 짧은 문장은 버리고, 마지막 도구 결과 뒤의 글만 씁니다.
let start = 0
blocks.forEach((b, n) => {
  if (b.type !== 'text') start = n + 1
})
let markdown = blocks
  .slice(start)
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('')
  .trim()

let stripped = 0
markdown = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (all, text, url) => {
  if (seen.has(url) || seenNorm.has(norm(url))) return all
  stripped++
  return text
})

if (markdown.length < 1500 || !markdown.includes('#')) {
  console.error(`글이 너무 짧거나 형식이 아닙니다 (${markdown.length}자). 지난 글을 그대로 둡니다.`)
  process.exit(0)
}

const searches = blocks.filter((b) => b.type === 'server_tool_use').length
writeFileSync(
  OUT_PATH,
  `${JSON.stringify({ edition, generatedAt: new Date().toISOString(), dateLine, markdown }, null, 2)}\n`,
)
const usage = responses.reduce(
  (acc, r) => ({ in: acc.in + (r.usage?.input_tokens ?? 0), out: acc.out + (r.usage?.output_tokens ?? 0) }),
  { in: 0, out: 0 },
)
console.log(
  `Must Read (${edition}) ${markdown.length}자 · 도구 호출 ${searches}회 · 근거 없는 링크 ${stripped}개 제거 · 토큰 입력 ${usage.in} / 출력 ${usage.out}`,
)
