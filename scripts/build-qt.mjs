/**
 * QT에 쓰는 성경 본문과 읽기표를 만듭니다. 결과물은 저장소에 커밋되어 있어서 평소에는 돌릴 일이 없습니다.
 * 읽기표(scripts/qt-plans.mjs)에 책을 더하거나 항목을 바꿨을 때만 다시 돌리세요.
 *
 *   git clone --depth 1 https://github.com/bluesaurel/korean-bible-1961-krv /tmp/krv
 *   node scripts/build-qt.mjs /tmp/krv
 *
 * 본문: 성경전서 개역한글판(1961), 대한성서공회. 저작권 보호기간이 끝난 판입니다.
 * 이용할 때는 출처(대한성서공회)를 밝히고 본문을 고치지 않습니다.
 *
 * 쓰는 파일
 *   public/bible/<책>.json   { id, name, abbr, unit, chapters: [[절, …], …] }
 *   public/qt/plans.json     { translation, plans: [{ id, title, summary, days: { "28": [본문…], …, "31": […] } }] }
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOOKS, PLANS, refLabel, segment } from './qt-plans.mjs'

const src = process.argv[2]
if (!src) {
  console.error('사용법: node scripts/build-qt.mjs <korean-bible-1961-krv 폴더>')
  process.exit(1)
}

const TRANSLATION = '성경전서 개역한글판 (1961) · 대한성서공회'
mkdirSync('public/bible', { recursive: true })
mkdirSync('public/qt', { recursive: true })

const verseCounts = {}
for (const [id, b] of Object.entries(BOOKS)) {
  const raw = JSON.parse(readFileSync(join(src, 'data', `${b.src}.json`), 'utf8'))
  const chapters = raw.chapters.map((c, ci) => {
    if (c.chapter !== ci + 1) throw new Error(`${b.src} ${c.chapter}장 순서가 맞지 않습니다`)
    return c.verses.map((v, vi) => {
      if (v.verse !== vi + 1) throw new Error(`${b.src} ${c.chapter}:${v.verse} 절 번호가 맞지 않습니다`)
      return v.text.trim()
    })
  })
  verseCounts[id] = chapters.map((c) => c.length)
  writeFileSync(
    `public/bible/${id}.json`,
    JSON.stringify({ id, name: b.name, abbr: b.abbr, unit: b.unit, translation: TRANSLATION, chapters }),
  )
  console.log(`public/bible/${id}.json  ${chapters.length}장 ${verseCounts[id].reduce((a, n) => a + n, 0)}절`)
}

const plans = PLANS.map((p) => {
  const days = {}
  for (const n of [28, 29, 30, 31]) {
    const segs = segment(p, n, verseCounts)
    if (segs.length !== n) throw new Error(`${p.id}: ${n}일로 나누지 못했습니다 (${segs.length}개)`)
    days[n] = segs.map((s) => ({ ...s, ref: refLabel(s, verseCounts) }))
  }
  const sizes = days[30].map((s) => {
    let n = 0
    for (let c = s.from[0]; c <= s.to[0]; c++) {
      const a = c === s.from[0] ? s.from[1] : 1
      const b = c === s.to[0] ? s.to[1] : verseCounts[s.book][c - 1]
      n += b - a + 1
    }
    return n
  })
  console.log(`${p.id}: 30일 기준 하루 ${Math.min(...sizes)}–${Math.max(...sizes)}절`)
  return { id: p.id, title: p.title, summary: p.summary, days }
})

writeFileSync('public/qt/plans.json', `${JSON.stringify({ translation: TRANSLATION, plans }, null, 1)}\n`)
console.log('public/qt/plans.json')
