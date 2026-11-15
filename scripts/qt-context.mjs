/**
 * 그날 QT 해석을 쓰기 전에 돌립니다. 항목마다 그날 본문을 절 번호와 함께 보여줍니다.
 *
 *   node scripts/qt-context.mjs              # 한국 시간 오늘
 *   node scripts/qt-context.mjs 2026-11-16   # 날짜 지정
 *
 * 이미 그날 파일이 있으면 맨 앞에 ALREADY_DONE을 찍습니다.
 */
import { existsSync, readFileSync } from 'node:fs'

const arg = process.argv[2]
const date = arg ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('날짜는 YYYY-MM-DD로 주세요.')
  process.exit(1)
}

const out = `public/data/qt/${date}.json`
if (existsSync(out)) console.log(`ALREADY_DONE ${out}`)

const [y, m, d] = date.split('-').map(Number)
const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
const { plans, translation } = JSON.parse(readFileSync('public/qt/plans.json', 'utf8'))
const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ko-KR', { weekday: 'long', timeZone: 'UTC' })

console.log(`날짜: ${y}년 ${m}월 ${d}일 ${weekday} (${days}일짜리 달의 ${d}일째)`)
console.log(`본문: ${translation}`)
console.log(`저장: node scripts/save-qt.mjs <초안.json>  →  ${out}`)
console.log('')

for (const p of plans) {
  const s = p.days[days][d - 1]
  const book = JSON.parse(readFileSync(`public/bible/${s.book}.json`, 'utf8'))
  console.log(`=== ${p.id} · ${p.title} · ${s.ref}`)
  for (let c = s.from[0]; c <= s.to[0]; c++) {
    const ch = book.chapters[c - 1]
    const a = c === s.from[0] ? s.from[1] : 1
    const b = c === s.to[0] ? s.to[1] : ch.length
    for (let v = a; v <= b; v++) console.log(`${c}:${v} ${ch[v - 1]}`)
  }
  console.log('')
}
