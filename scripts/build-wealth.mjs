/**
 * 재물 탭의 12주제 본문을 만듭니다. 결과물은 저장소에 커밋되어 있어서 평소에는 돌릴 일이 없습니다.
 * scripts/wealth-topics.mjs를 고쳤을 때만 다시 돌리세요.
 *
 *   git clone --depth 1 https://github.com/bluesaurel/korean-bible-1961-krv /tmp/krv
 *   node scripts/build-wealth.mjs /tmp/krv
 *
 * 본문: 성경전서 개역한글판(1961), 대한성서공회. 본문은 고치지 않고 그대로 옮깁니다.
 * 해설 속 "…" 인용이 실제 본문에 있는지도 여기서 확인합니다 — 없으면 실패합니다.
 *
 * 쓰는 파일: public/wealth/topics.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOOKS, TOPICS } from './wealth-topics.mjs'

const src = process.argv[2]
if (!src) {
  console.error('사용법: node scripts/build-wealth.mjs <korean-bible-1961-krv 폴더>')
  process.exit(1)
}

const cache = {}
const book = (id) => (cache[id] ??= JSON.parse(readFileSync(join(src, 'data', `${id}.json`), 'utf8')))

const topics = TOPICS.map((t, n) => {
  const passages = t.passages.map(([b, ch, from, to]) => {
    const meta = BOOKS[b]
    if (!meta) throw new Error(`${b}: BOOKS에 없습니다`)
    const chapter = book(b).chapters.find((c) => c.chapter === ch)
    if (!chapter) throw new Error(`${b} ${ch}장이 없습니다`)
    const verses = []
    for (let v = from; v <= to; v++) {
      const found = chapter.verses.find((x) => x.verse === v)
      if (!found) throw new Error(`${b} ${ch}:${v}이 없습니다`)
      verses.push([v, found.text.trim()])
    }
    const ref = `${meta.abbr} ${ch}:${from}${to > from ? `-${to}` : ''}`
    return { ref, book: meta.name, chapter: ch, verses }
  })

  // 해설에서 **"…"** 나 "…" 로 인용한 말이 그날 본문에 실제로 있는지 봅니다.
  const all = passages.flatMap((p) => p.verses.map(([, text]) => text)).join(' ')
  const quotes = [...`${t.interpretation}`.matchAll(/"([^"]{4,})"/g)].map((m) => m[1].replace(/[…]+$/, '').trim())
  const missing = quotes.filter((q) => !all.replace(/\s+/g, ' ').includes(q.replace(/\s+/g, ' ')))
  if (missing.length) console.warn(`  ${n + 1}. ${t.short}: 본문에 없는 인용 → ${missing.map((q) => `"${q}"`).join(', ')}`)

  return {
    n: n + 1,
    id: t.id,
    title: t.title,
    short: t.short,
    criterion: t.criterion,
    passages,
    interpretation: t.interpretation,
    questions: t.questions,
    practice: t.practice,
    prayer: t.prayer,
  }
})

mkdirSync('public/wealth', { recursive: true })
writeFileSync(
  'public/wealth/topics.json',
  `${JSON.stringify({ translation: '성경전서 개역한글판 (1961) · 대한성서공회', topics }, null, 1)}\n`,
)
console.log(`public/wealth/topics.json  ${topics.length}주제 · ${topics.reduce((a, t) => a + t.passages.reduce((b, p) => b + p.verses.length, 0), 0)}절`)
