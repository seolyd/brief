/**
 * 쓴 마크다운을 검사하고 public/data/mustread-<edition>.json으로 저장합니다.
 *
 *   node scripts/save-mustread.mjs morning /tmp/mustread.md
 *
 * 검사에 걸리면 이유를 보여주고 1로 끝납니다. 고쳐서 다시 실행하세요.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [editionArg, file] = process.argv.slice(2)
if (!['morning', 'evening'].includes(editionArg) || !file) {
  console.error('사용법: node scripts/save-mustread.mjs <morning|evening> <마크다운 파일>')
  process.exit(1)
}
const edition = editionArg
const markdown = readFileSync(file, 'utf8').trim()

const problems = []
const chars = markdown.replace(/\s+/g, '').length
if (chars < 3000) problems.push(`너무 짧습니다 (${chars}자, 공백 제외). 6,000자 안팎이 목표입니다.`)
if (!/^# /m.test(markdown)) problems.push('맨 위 제목(# …)이 없습니다.')
if ((markdown.match(/^## /gm) ?? []).length < 4) problems.push('섹션(## …)이 4개 미만입니다.')
if (!markdown.includes('오늘의 한 문장')) problems.push("'오늘의 한 문장'이 없습니다.")
const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1])
if (links.length < 5) problems.push(`출처 링크가 ${links.length}개뿐입니다. 항목마다 출처를 붙이세요.`)
const badLinks = links.filter((u) => !/^https?:\/\//i.test(u))
if (badLinks.length) problems.push(`http(s)가 아닌 링크: ${badLinks.join(', ')}`)
const tags = markdown.match(/<\/?[a-z][a-z0-9]*[^>]*>/gi)
if (tags) problems.push(`HTML 태그가 있습니다 (앱이 글자로 보여줍니다): ${[...new Set(tags)].slice(0, 5).join(' ')}`)

if (problems.length) {
  console.error('저장하지 않았습니다:\n- ' + problems.join('\n- '))
  process.exit(1)
}

const out = `public/data/mustread-${edition}.json`
writeFileSync(out, `${JSON.stringify({ edition, generatedAt: new Date().toISOString(), markdown }, null, 2)}\n`)
console.log(`저장: ${out} (${chars}자, 링크 ${links.length}개)`)
