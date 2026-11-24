/**
 * 브리프를 쓰기 전에 필요한 것을 한 번에 보여줍니다.
 *
 *   node scripts/mustread-context.mjs morning        # Biz.Brief (사업 아이템·돈 버는 방법)
 *   node scripts/mustread-context.mjs morning all    # All.Brief (일반 뉴스)
 *
 * 날짜 줄(한국 시간), 독자 프로필, 지난 24시간 수집 기사 목록. 오늘 이 판이 이미 있으면 첫 줄에 알립니다.
 */
import { existsSync, readFileSync } from 'node:fs'

const edition = process.argv[2] === 'evening' ? 'evening' : 'morning'
const kind = process.argv[3] === 'all' ? 'all' : 'biz'
const feed = JSON.parse(readFileSync('public/data/feed.json', 'utf8'))
const profile = JSON.parse(readFileSync('sources.json', 'utf8')).profile ?? {}

const kst = (d, opts) => d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', ...opts })
const ymd = (d) => kst(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
const today = ymd(new Date())

const out = `public/data/${kind === 'biz' ? 'bizbrief' : 'allbrief'}-${edition}.json`
if (existsSync(out)) {
  const prev = JSON.parse(readFileSync(out, 'utf8'))
  if (prev.generatedAt && ymd(new Date(prev.generatedAt)) === today) {
    console.log(`ALREADY_DONE: 오늘(${today}) ${kind}/${edition} 브리프가 이미 있습니다 (${prev.generatedAt}). 새로 쓰지 마세요.`)
    process.exit(0)
  }
}

const dateLine = `${kst(new Date(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 한국시간 ${edition === 'morning' ? '오전' : '저녁'} 기준`
const label = Object.fromEntries((feed.domains ?? []).map((d) => [d.id, d.label]))
const since = Date.now() - 24 * 3_600_000
const ageH = ((Date.now() - Date.parse(feed.generatedAt)) / 3_600_000).toFixed(1)

// Biz는 국내 동네 사업·해외 동네 사업을 먼저 두고 창업·한국 산업을 곁들입니다. All은 일간지 헤드라인이 먼저입니다.
const order = kind === 'biz' ? ['local', 'ideas', 'startup', 'korea', 'career', 'tech'] : ['news', 'tech', 'career', 'global']
const cap = kind === 'biz' ? { local: 60, ideas: 40, startup: 25, korea: 15, career: 12, tech: 10 } : { news: 60, tech: 15, career: 8, global: 10 }

console.log(`종류: ${kind === 'biz' ? 'Biz.Brief (사업 아이템·돈 버는 방법)' : 'All.Brief (일반 뉴스)'} · 판: ${edition}`)
console.log(`출력 파일: ${out}`)
console.log(`날짜 줄: ${dateLine}`)
console.log(`피드 수집 시각: ${feed.generatedAt} (${ageH}시간 전)${Number(ageH) > 6 ? ' — 오래됐습니다. 웹 검색 비중을 높이세요.' : ''}`)
if (kind === 'biz') {
  console.log(`\n독자: ${profile.reader ?? ''}`)
  console.log(`관심사: ${(profile.interests ?? []).join(', ')}`)
  console.log('이 글에서는 주가·지수·종목 매매 이야기를 하지 않습니다. 돈을 버는 사업과 일의 이야기만 씁니다.')
} else {
  console.log(`\n독자: ${profile.reader ?? ''} — 이 글에서는 투자·시장 이야기를 하지 않습니다.`)
}
console.log('\n── 지난 24시간 수집 기사 ──')
// 한 분야 안에서 발행처를 번갈아 고릅니다. 기사가 많은 발행처 몇 곳이 칸을 다 차지하면
// Product Hunt·Show HN처럼 아이템이 많은 소스가 잘려 나가기 때문입니다.
// 주간 소스(Trends.vc 등)는 24시간 안에 글이 없을 때가 많아 Biz는 72시간까지 봅니다.
const sinceFor = (id) => (kind === 'biz' && ['local', 'ideas', 'startup'].includes(id) ? Date.now() - 72 * 3_600_000 : since)
function balanced(id, n) {
  const pool = feed.items.filter((i) => i.domain === id && i.kind === 'article' && Date.parse(i.publishedAt) >= sinceFor(id))
  const bySource = new Map()
  for (const i of pool) bySource.set(i.sourceId, [...(bySource.get(i.sourceId) ?? []), i])
  const queues = [...bySource.values()]
  const picked = []
  while (picked.length < n && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && picked.length < n) picked.push(q.shift())
  }
  return picked
}
for (const id of order) {
  const n = typeof cap === 'number' ? cap : cap[id]
  const items = balanced(id, n)
  if (!items.length) continue
  console.log(`\n[${label[id] ?? id}]`)
  for (const i of items) console.log(`- (${i.sourceName}) ${i.title}\n  ${i.url}${i.excerpt ? `\n  ${i.excerpt}` : ''}`)
}
