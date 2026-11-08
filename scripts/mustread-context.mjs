/**
 * 브리프를 쓰기 전에 필요한 것을 한 번에 보여줍니다.
 *
 *   node scripts/mustread-context.mjs morning        # Inv.Brief (투자·경제)
 *   node scripts/mustread-context.mjs morning all    # All.Brief (일반 뉴스)
 *
 * 날짜 줄(한국 시간), 독자 프로필, 지난 24시간 수집 기사 목록. 오늘 이 판이 이미 있으면 첫 줄에 알립니다.
 */
import { existsSync, readFileSync } from 'node:fs'

const edition = process.argv[2] === 'evening' ? 'evening' : 'morning'
const kind = process.argv[3] === 'all' ? 'all' : 'inv'
const feed = JSON.parse(readFileSync('public/data/feed.json', 'utf8'))
const profile = JSON.parse(readFileSync('sources.json', 'utf8')).profile ?? {}

const kst = (d, opts) => d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', ...opts })
const ymd = (d) => kst(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
const today = ymd(new Date())

const out = `public/data/${kind === 'inv' ? 'mustread' : 'allbrief'}-${edition}.json`
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

// Inv는 투자·경제 분야, All은 일간지 헤드라인을 먼저 두고 테크·커리어를 곁들입니다.
const order = kind === 'inv' ? ['global', 'markets', 'tech', 'korea', 'career'] : ['news', 'tech', 'career', 'global']
const cap = kind === 'inv' ? 25 : { news: 60, tech: 15, career: 8, global: 10 }

console.log(`종류: ${kind === 'inv' ? 'Inv.Brief (투자·경제)' : 'All.Brief (일반 뉴스)'} · 판: ${edition}`)
console.log(`출력 파일: ${out}`)
console.log(`날짜 줄: ${dateLine}`)
console.log(`피드 수집 시각: ${feed.generatedAt} (${ageH}시간 전)${Number(ageH) > 6 ? ' — 오래됐습니다. 웹 검색 비중을 높이세요.' : ''}`)
if (kind === 'inv') {
  console.log(`\n독자: ${profile.reader ?? ''}`)
  console.log(`관심사: ${(profile.interests ?? []).join(', ')}`)
  console.log(`지켜보는 종목: ${(profile.watchlist ?? []).join(', ')}`)
} else {
  console.log(`\n독자: ${profile.reader ?? ''} — 이 글에서는 투자·시장 이야기를 하지 않습니다.`)
}
console.log('\n── 지난 24시간 수집 기사 ──')
for (const id of order) {
  const n = typeof cap === 'number' ? cap : cap[id]
  const items = feed.items.filter((i) => i.domain === id && i.kind === 'article' && Date.parse(i.publishedAt) >= since).slice(0, n)
  if (!items.length) continue
  console.log(`\n[${label[id] ?? id}]`)
  for (const i of items) console.log(`- (${i.sourceName}) ${i.title}\n  ${i.url}${i.excerpt ? `\n  ${i.excerpt}` : ''}`)
}
