/**
 * 쓴 QT 해석 초안(JSON)을 검사하고 public/data/qt/<날짜>.json으로 저장합니다.
 *
 *   node scripts/save-qt.mjs /tmp/qt.json
 *
 * 초안 모양
 *   {
 *     "date": "2026-11-16",
 *     "entries": {
 *       "<항목 id>": {
 *         "ref": "요한복음 8:31–59",          // qt-context가 보여준 그대로
 *         "title": "진리가 너희를 자유케 하리라", // 30자 이내 묵상 제목
 *         "keyVerse": [8, 32],               // 본문 안의 한 절 [장, 절]
 *         "interpretation": "마크다운 해석",   // 공백 제외 250~900자
 *         "questions": ["…", "…"],           // 2~3개
 *         "prayer": "…"                      // 짧은 기도
 *       }, …
 *     }
 *   }
 *
 * 검사에 걸리면 이유를 보여주고 1로 끝납니다. 고쳐서 다시 실행하세요.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('사용법: node scripts/save-qt.mjs <초안.json>')
  process.exit(1)
}

let draft
try {
  draft = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`JSON을 읽지 못했습니다: ${e.message}`)
  process.exit(1)
}

const problems = []
const date = draft.date
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) problems.push('date가 YYYY-MM-DD가 아닙니다.')

const { plans } = JSON.parse(readFileSync('public/qt/plans.json', 'utf8'))
const entries = {}
if (!problems.length) {
  const [y, m, d] = date.split('-').map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const len = (s) => String(s ?? '').replace(/\s+/g, '').length
  const html = /<\/?[a-z][a-z0-9]*[^>]*>/i
  const link = /https?:\/\/|\]\(/i

  for (const p of plans) {
    const s = p.days[days][d - 1]
    const e = draft.entries?.[p.id]
    const at = `${p.id}(${s.ref})`
    if (!e) {
      problems.push(`${at}: 항목이 없습니다.`)
      continue
    }
    if (e.ref !== s.ref) problems.push(`${at}: ref가 '${e.ref}'입니다. '${s.ref}' 그대로 쓰세요.`)
    const title = String(e.title ?? '').trim()
    if (!title || title.length > 30) problems.push(`${at}: title은 1~30자여야 합니다 (${title.length}자).`)
    const kv = e.keyVerse
    const inside =
      Array.isArray(kv) &&
      kv.length === 2 &&
      kv.every(Number.isInteger) &&
      (kv[0] > s.from[0] || (kv[0] === s.from[0] && kv[1] >= s.from[1])) &&
      (kv[0] < s.to[0] || (kv[0] === s.to[0] && kv[1] <= s.to[1]))
    if (!inside) problems.push(`${at}: keyVerse ${JSON.stringify(kv)}가 본문 밖입니다.`)
    const n = len(e.interpretation)
    if (n < 250 || n > 900) problems.push(`${at}: 해석이 ${n}자입니다 (공백 제외 250~900자).`)
    const qs = Array.isArray(e.questions) ? e.questions.map((q) => String(q).trim()).filter(Boolean) : []
    if (qs.length < 2 || qs.length > 3) problems.push(`${at}: 묵상 질문은 2~3개입니다 (${qs.length}개).`)
    if (qs.some((q) => q.length > 120)) problems.push(`${at}: 120자가 넘는 질문이 있습니다.`)
    const prayer = String(e.prayer ?? '').trim()
    if (len(prayer) < 20 || len(prayer) > 250) problems.push(`${at}: 기도는 공백 제외 20~250자입니다 (${len(prayer)}자).`)
    for (const [k, v] of [['title', title], ['interpretation', e.interpretation], ['prayer', prayer], ...qs.map((q) => ['question', q])]) {
      if (html.test(String(v))) problems.push(`${at}: ${k}에 HTML 태그가 있습니다.`)
      if (link.test(String(v))) problems.push(`${at}: ${k}에 링크가 있습니다. 링크는 쓰지 않습니다.`)
    }
    if (/^#{1,2} /m.test(String(e.interpretation))) problems.push(`${at}: 해석 안에서 #, ## 제목은 쓰지 않습니다 (### 까지만).`)
    entries[p.id] = {
      ref: s.ref,
      title,
      keyVerse: kv,
      interpretation: String(e.interpretation).trim(),
      questions: qs,
      prayer,
    }
  }
}

if (problems.length) {
  console.error('저장하지 않았습니다:\n- ' + problems.join('\n- '))
  process.exit(1)
}

const out = `public/data/qt/${date}.json`
writeFileSync(out, `${JSON.stringify({ date, generatedAt: new Date().toISOString(), entries }, null, 2)}\n`)
console.log(`저장: ${out} (항목 ${Object.keys(entries).length}개)`)
