/**
 * Must Read를 쓰기 전에 필요한 것을 한 번에 보여줍니다.
 *
 *   node scripts/mustread-context.mjs morning
 *
 * 날짜 줄(한국 시간), 독자 프로필, 지난 24시간 수집 기사 목록. 오늘 이 판이 이미 있으면 첫 줄에 알립니다.
 */
import { existsSync, readFileSync } from 'node:fs'

const edition = process.argv[2] === 'evening' ? 'evening' : 'morning'
const feed = JSON.parse(readFileSync('public/data/feed.json', 'utf8'))
const profile = JSON.parse(readFileSync('sources.json', 'utf8')).profile ?? {}

const kst = (d, opts) => d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', ...opts })
const today = kst(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' })

const out = `public/data/mustread-${edition}.json`
if (existsSync(out)) {
  const prev = JSON.parse(readFileSync(out, 'utf8'))
  if (prev.generatedAt && kst(new Date(prev.generatedAt), { year: 'numeric', month: '2-digit', day: '2-digit' }) === today) {
    console.log(`ALREADY_DONE: 오늘(${today}) ${edition} Must Read가 이미 있습니다 (${prev.generatedAt}). 새로 쓰지 마세요.`)
    process.exit(0)
  }
}

const dateLine = `${kst(new Date(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 한국시간 ${edition === 'morning' ? '오전' : '저녁'} 기준`
const label = Object.fromEntries((feed.domains ?? []).map((d) => [d.id, d.label]))
const since = Date.now() - 24 * 3_600_000

console.log(`판: ${edition}`)
console.log(`날짜 줄: ${dateLine}`)
console.log(`피드 수집 시각: ${feed.generatedAt}`)
console.log(`\n독자: ${profile.reader ?? ''}`)
console.log(`관심사: ${(profile.interests ?? []).join(', ')}`)
console.log(`지켜보는 종목: ${(profile.watchlist ?? []).join(', ')}`)
console.log('\n── 지난 24시간 수집 기사 ──')
for (const d of feed.domains ?? []) {
  const items = feed.items.filter((i) => i.domain === d.id && i.kind === 'article' && Date.parse(i.publishedAt) >= since).slice(0, 25)
  if (!items.length) continue
  console.log(`\n[${label[d.id]}]`)
  for (const i of items) console.log(`- (${i.sourceName}) ${i.title}\n  ${i.url}${i.excerpt ? `\n  ${i.excerpt}` : ''}`)
}
