/**
 * QT 읽기표. 이달의 QT로 고를 수 있는 항목과, 날짜마다 읽을 본문을 정합니다.
 *
 * 앱과 예약 작업이 같은 본문을 보도록, 이 파일로 public/qt/plans.json을 미리 만들어 둡니다
 * (scripts/build-qt.mjs). 항목을 바꾸면 그 스크립트를 다시 돌리세요.
 *
 * 한 달의 날 수(28~31일)에 맞춰 본문을 나눕니다. 장 단위에서 시작해서,
 * 날보다 장이 많으면 짧은 이웃 장을 합치고, 적으면 가장 긴 덩어리를 반으로 가릅니다.
 */

export const BOOKS = {
  psalms: { name: '시편', abbr: '시', src: 'Psalms', unit: '편' },
  proverbs: { name: '잠언', abbr: '잠', src: 'Proverbs', unit: '장' },
  matthew: { name: '마태복음', abbr: '마', src: 'Matthew', unit: '장' },
  john: { name: '요한복음', abbr: '요', src: 'John', unit: '장' },
  philippians: { name: '빌립보서', abbr: '빌', src: 'Philippians', unit: '장' },
  colossians: { name: '골로새서', abbr: '골', src: 'Colossians', unit: '장' },
}

/**
 * chapters: [책, 시작 장, 끝 장] — 장 하나가 하루 몫인 책.
 * units: [책, '장:절-절', '장:절-장:절', …] — 단락 단위. 이야기 중간에서 끊기지 않게 직접 나눈 경계입니다.
 */
export const PLANS = [
  {
    id: 'proverbs',
    title: '잠언 한 달',
    summary: '하루 한 장, 날짜와 같은 장을 읽습니다. 일상의 지혜와 말·돈·관계를 돌아봅니다.',
    chapters: [['proverbs', 1, 31]],
  },
  {
    id: 'psalms',
    title: '시편 1–31편',
    summary: '하루 한 편. 기도와 찬양, 탄식의 언어로 하루를 엽니다.',
    chapters: [['psalms', 1, 31]],
  },
  {
    id: 'sermon',
    title: '산상수훈과 그 이후',
    summary: '마태복음 5–9장. 팔복과 주기도문, 반석 위의 집, 그리고 말씀대로 사람들을 고치시는 예수님.',
    units: [
      ['matthew', '5:1-6', '5:7-12', '5:13-16', '5:17-20', '5:21-26', '5:27-32', '5:33-37', '5:38-42', '5:43-48'],
      ['matthew', '6:1-4', '6:5-8', '6:9-13', '6:14-18', '6:19-24', '6:25-34'],
      ['matthew', '7:1-6', '7:7-12', '7:13-14', '7:15-20', '7:21-23', '7:24-29'],
      ['matthew', '8:1-4', '8:5-13', '8:14-17', '8:18-22', '8:23-27', '8:28-34'],
      ['matthew', '9:1-8', '9:9-13', '9:14-17', '9:18-26', '9:27-34', '9:35-38'],
    ],
  },
  {
    id: 'john',
    title: '요한복음',
    summary: '한 달에 요한복음 전체. "보라, 믿으라, 생명을 얻으라"는 흐름을 따라갑니다.',
    units: [
      ['john', '1:1-18', '1:19-34', '1:35-51', '2:1-12', '2:13-25', '3:1-21', '3:22-36', '4:1-26', '4:27-42', '4:43-54'],
      ['john', '5:1-18', '5:19-47', '6:1-21', '6:22-40', '6:41-71', '7:1-24', '7:25-53', '8:1-11', '8:12-30', '8:31-59'],
      ['john', '9:1-41', '10:1-21', '10:22-42', '11:1-27', '11:28-57', '12:1-19', '12:20-50', '13:1-38', '14:1-31'],
      ['john', '15:1-27', '16:1-33', '17:1-26', '18:1-27', '18:28-40', '19:1-30', '19:31-42', '20:1-31', '21:1-25'],
    ],
  },
  {
    id: 'phil-col',
    title: '빌립보서·골로새서',
    summary: '옥중서신 두 권. 기쁨과 감사, 그리스도 안의 새 삶을 하루 몇 절씩 묵상합니다.',
    units: [
      ['philippians', '1:1-11', '1:12-18', '1:19-26', '1:27-30', '2:1-4', '2:5-11', '2:12-18', '2:19-30'],
      ['philippians', '3:1-11', '3:12-16', '3:17-21', '4:1-7', '4:8-9', '4:10-20', '4:21-23'],
      ['colossians', '1:1-8', '1:9-14', '1:15-20', '1:21-23', '1:24-29', '2:1-5', '2:6-15', '2:16-23'],
      ['colossians', '3:1-4', '3:5-11', '3:12-17', '3:18-4:1', '4:2-6', '4:7-18'],
    ],
  },
]

/**
 * verseCounts: { 책: [장별 절 수] }
 * 반환: 날짜 순 본문 목록. 각 본문은 { book, from: [장, 절], to: [장, 절] }
 */
export function segment(plan, days, verseCounts) {
  // 덩어리 = 같은 책 안에서 이어진 절 범위. len은 절 수.
  let parts = []
  for (const [book, c1, c2] of plan.chapters ?? []) {
    for (let c = c1; c <= c2; c++) {
      const n = verseCounts[book][c - 1]
      parts.push({ book, from: [c, 1], to: [c, n], len: n })
    }
  }
  for (const [book, ...ranges] of plan.units ?? []) {
    for (const r of ranges) {
      const m = r.match(/^(\d+):(\d+)-(?:(\d+):)?(\d+)$/)
      if (!m) throw new Error(`${plan.id}: 범위 형식이 틀렸습니다 (${r})`)
      const from = [Number(m[1]), Number(m[2])]
      const to = [Number(m[3] ?? m[1]), Number(m[4])]
      parts.push({ book, from, to, len: countVerses(book, from, to, verseCounts) })
    }
  }
  checkContiguous(plan, parts, verseCounts)
  while (parts.length > days) {
    let best = -1
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].book !== parts[i + 1].book) continue
      if (best < 0 || parts[i].len + parts[i + 1].len < parts[best].len + parts[best + 1].len) best = i
    }
    if (best < 0) break
    const a = parts[best]
    const b = parts[best + 1]
    parts.splice(best, 2, { book: a.book, from: a.from, to: b.to, len: a.len + b.len })
  }
  while (parts.length < days) {
    let best = 0
    for (let i = 1; i < parts.length; i++) if (parts[i].len > parts[best].len) best = i
    const p = parts[best]
    if (p.len < 2 || p.from[0] !== p.to[0]) break
    const half = Math.ceil(p.len / 2)
    const c = p.from[0]
    const mid = p.from[1] + half - 1
    parts.splice(
      best,
      1,
      { book: p.book, from: [c, p.from[1]], to: [c, mid], len: half },
      { book: p.book, from: [c, mid + 1], to: [c, p.to[1]], len: p.len - half },
    )
  }
  return parts.map(({ book, from, to }) => ({ book, from, to }))
}

export function countVerses(book, from, to, verseCounts) {
  let n = 0
  for (let c = from[0]; c <= to[0]; c++) {
    const last = verseCounts[book][c - 1]
    if (last == null) throw new Error(`${book} ${c}장이 없습니다`)
    const a = c === from[0] ? from[1] : 1
    const b = c === to[0] ? to[1] : last
    if (b > last || a > b) throw new Error(`${book} ${c}:${a}-${b} 범위가 장을 벗어납니다`)
    n += b - a + 1
  }
  return n
}

/** 단락 사이에 빠지거나 겹치는 절이 없는지 확인합니다. */
function checkContiguous(plan, parts, verseCounts) {
  for (let i = 1; i < parts.length; i++) {
    const a = parts[i - 1]
    const b = parts[i]
    if (a.book !== b.book) continue
    const [c, v] = a.to
    const next = v < verseCounts[a.book][c - 1] ? [c, v + 1] : [c + 1, 1]
    if (b.from[0] !== next[0] || b.from[1] !== next[1]) {
      throw new Error(`${plan.id}: ${a.book} ${c}:${v} 다음이 ${b.from.join(':')}입니다 (빠지거나 겹침)`)
    }
  }
}

/** "요한복음 3:1–21", "잠언 3장", "시편 23편", "요한복음 3:31–4:6" */
export function refLabel({ book, from, to }, verseCounts) {
  const b = BOOKS[book]
  const whole = from[1] === 1 && to[1] === verseCounts[book][to[0] - 1]
  if (whole && from[0] === to[0]) return `${b.name} ${from[0]}${b.unit}`
  if (whole) return `${b.name} ${from[0]}–${to[0]}${b.unit}`
  if (from[0] === to[0]) return `${b.name} ${from[0]}:${from[1]}–${to[1]}`
  return `${b.name} ${from[0]}:${from[1]}–${to[0]}:${to[1]}`
}
