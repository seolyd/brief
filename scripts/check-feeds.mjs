/**
 * 후보 주소가 열리고 파싱되는지 실제 수집기로 확인합니다.
 *
 *   node scripts/check-feeds.mjs https://a.com/rss https://b.com/feed
 *   node scripts/check-feeds.mjs --all      # sources.json 전체
 *
 * 200이 떠도 엉뚱한 발행처일 수 있으니 출력된 최신 제목을 꼭 보세요.
 */
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const all = args.includes('--all')
const sources = all
  ? JSON.parse(readFileSync('sources.json', 'utf8')).sources
  : args
      .flatMap((a) => a.split(/[\s,]+/))
      .filter((u) => /^https?:\/\//i.test(u))
      .map((url, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, domain: 'tech', name: url, url }))

if (!sources.length) {
  console.error('사용법: node scripts/check-feeds.mjs <주소> [<주소> …]  또는  --all')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'check-feeds-'))
const cfg = join(dir, 'sources.json')
const out = join(dir, 'feed.json')
writeFileSync(cfg, JSON.stringify({ sources }))

const code = await new Promise((resolve) => {
  const child = spawn('node', [new URL('fetch-feed.mjs', import.meta.url).pathname], {
    env: { ...process.env, FEED_SOURCES: cfg, FEED_OUT: out },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  child.on('exit', resolve)
})

let data
try {
  data = JSON.parse(readFileSync(out, 'utf8'))
} catch {
  console.error(`수집기가 결과를 쓰지 못했습니다 (exit ${code}).`)
  process.exit(1)
}

const line = '─'.repeat(70)
console.log(`\n${line}\n열림 ${data.report.ok.length}개 · 막힘 ${data.report.failed.length}개 / 후보 ${sources.length}개\n${line}\n`)
for (const s of sources) {
  const ok = data.report.ok.find((r) => r.id === s.id)
  if (!ok) continue
  const mine = data.items.filter((i) => i.sourceId === s.id)
  const eps = mine.filter((i) => i.kind === 'episode').length
  console.log(`✓ ${s.url}\n    최근 7일 ${ok.count}개 / 피드 전체 ${ok.parsed}개${eps ? ` (에피소드 ${eps})` : ''}`)
  for (const i of mine.slice(0, 3)) console.log(`    ${i.publishedAt.slice(0, 10)} — ${i.title}`)
  console.log()
}
for (const f of data.report.failed) console.log(`✗ ${f.url}\n    ${f.error}\n`)
