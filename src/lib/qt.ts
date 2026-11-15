/**
 * Daily QT. 이달의 QT 항목을 고르면 날짜마다 정해진 본문을 읽고, 해석을 보고, 나의 다짐을 적습니다.
 *
 *   /qt/plans.json            읽기표 (scripts/build-qt.mjs가 만듭니다)
 *   /bible/<책>.json          개역한글 본문
 *   /data/qt/<날짜>.json      그날의 해석·묵상 질문·기도 (매일 아침 7시 전 예약 작업이 씁니다)
 *
 * 하루는 한국 시간 아침 7시에 바뀝니다. 7시 전에는 어제 QT를 보여줍니다.
 * 고른 항목과 기록은 전부 이 기기의 localStorage에만 있습니다.
 */

export type Ref = [chapter: number, verse: number]

export interface Passage {
  book: string
  from: Ref
  to: Ref
  ref: string
}

export interface Plan {
  id: string
  title: string
  summary: string
  days: Record<string, Passage[]>
}

export interface PlansFile {
  translation: string
  plans: Plan[]
}

export interface BibleBook {
  id: string
  name: string
  abbr: string
  unit: string
  translation: string
  chapters: string[][]
}

export interface QtEntry {
  ref: string
  title: string
  keyVerse: Ref
  interpretation: string
  questions: string[]
  prayer: string
}

export interface QtFile {
  date: string
  generatedAt: string
  entries: Record<string, QtEntry>
}

export interface QtRecord {
  planId: string
  ref: string
  /** 마음에 남은 말씀 */
  verse: string
  /** 나의 묵상(해석) */
  meditation: string
  /** 나의 다짐 */
  resolution: string
  prayer: string
  done: boolean
  updatedAt: string
}

export const OPEN_HOUR = 7

/** 한국 시간 기준 QT 날짜. 7시 전이면 어제입니다. */
export function qtToday(now = new Date()): { key: string; beforeOpen: boolean } {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const beforeOpen = kst.getUTCHours() < OPEN_HOUR
  if (beforeOpen) kst.setUTCDate(kst.getUTCDate() - 1)
  return { key: kst.toISOString().slice(0, 10), beforeOpen }
}

export const monthOf = (date: string) => date.slice(0, 7)
export const dayOf = (date: string) => Number(date.slice(8, 10))

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export function dateLabel(date: string, opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' }) {
  return new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', ...opts })
}

export function passageFor(plan: Plan, date: string): Passage | null {
  const list = plan.days[String(daysInMonth(monthOf(date)))]
  return list?.[dayOf(date) - 1] ?? null
}

/** 본문을 [장, 절, 글] 목록으로 펼칩니다. */
export function versesOf(book: BibleBook, p: Passage): Array<[number, number, string]> {
  const out: Array<[number, number, string]> = []
  for (let c = p.from[0]; c <= p.to[0]; c++) {
    const ch = book.chapters[c - 1] ?? []
    const a = c === p.from[0] ? p.from[1] : 1
    const b = c === p.to[0] ? p.to[1] : ch.length
    for (let v = a; v <= b; v++) out.push([c, v, ch[v - 1] ?? ''])
  }
  return out
}

async function getJson<T>(path: string, cache: RequestCache = 'no-cache'): Promise<T | null> {
  try {
    const res = await fetch(path, { cache })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

let plansPromise: Promise<PlansFile | null> | null = null
export function loadPlans(): Promise<PlansFile | null> {
  plansPromise ??= getJson<PlansFile>('/qt/plans.json')
  return plansPromise
}

const books = new Map<string, Promise<BibleBook | null>>()
export function loadBook(id: string): Promise<BibleBook | null> {
  if (!books.has(id)) {
    // 본문은 바뀌지 않으니 브라우저 캐시를 그대로 씁니다.
    const p = getJson<BibleBook>(`/bible/${id}.json`, 'default')
    books.set(id, p)
    void p.then((b) => b ?? books.delete(id))
  }
  return books.get(id)!
}

const qtFiles = new Map<string, Promise<QtFile | null>>()
export function loadQt(date: string): Promise<QtFile | null> {
  if (!qtFiles.has(date)) {
    const p = getJson<QtFile>(`/data/qt/${date}.json`)
    qtFiles.set(date, p)
    // 아직 안 써진 날은 다음에 다시 물어봅니다.
    void p.then((f) => f ?? qtFiles.delete(date))
  }
  return qtFiles.get(date)!
}

/** 기록이 있는 날 = 묵상이나 다짐을 한 줄이라도 적었거나 마치기를 누른 날 */
export const hasRecord = (r?: QtRecord) => !!r && (r.done || !!r.meditation.trim() || !!r.resolution.trim())

/** 오늘(또는 오늘 아직 안 했으면 어제)까지 이어진 날 수 */
export function streak(records: Record<string, QtRecord>, today: string): number {
  let d = hasRecord(records[today]) ? today : shiftDate(today, -1)
  let n = 0
  while (hasRecord(records[d])) {
    n++
    d = shiftDate(d, -1)
  }
  return n
}

/** 매일 아침 7시 반복 일정을 휴대폰 캘린더에 넣는 .ics 파일 */
export function reminderIcs(url: string, startDate: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const day = startDate.replace(/-/g, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daily Brief//QT//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:daily-qt-${day}@brief`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Seoul:${day}T070000`,
    `DTEND;TZID=Asia/Seoul:${day}T071500`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Daily QT',
    'DESCRIPTION:오늘의 말씀을 읽고 나의 다짐을 적어 보세요.',
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Daily QT',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
