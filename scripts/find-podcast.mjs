/**
 * 팟캐스트 이름으로 RSS 주소를 찾습니다 (Apple Podcasts 검색 API, 키 없음).
 *
 *   node scripts/find-podcast.mjs "손에 잡히는 경제"
 *
 * 찾은 주소를 sources.json에 손으로 넣어야 수집됩니다.
 */
const term = process.argv.slice(2).join(' ').trim()
if (!term) {
  console.error('사용법: node scripts/find-podcast.mjs <쇼 이름>')
  process.exit(1)
}
const url = `https://itunes.apple.com/search?media=podcast&limit=5&country=KR&term=${encodeURIComponent(term)}`
const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
if (!res.ok) {
  console.error(`검색 실패: HTTP ${res.status}`)
  process.exit(1)
}
const { results = [] } = await res.json()
if (!results.length) {
  console.log('  결과 없음')
  process.exit(1)
}
for (const r of results) {
  console.log(`  ${r.collectionName} — ${r.artistName}`)
  console.log(`    ${r.feedUrl ?? '(피드 주소 없음)'}`)
}
