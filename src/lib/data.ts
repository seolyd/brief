/** GitHub Action이 매일 아침 쓰는 두 정적 파일의 모양과 읽기. */

export type DomainId = 'global' | 'markets' | 'tech' | 'korea' | 'career'

export interface Domain {
  id: DomainId
  label: string
  focus: string
  /** 아침 헤드라인에서 이 분야가 차지하는 칸 수 */
  morning: number
}

export interface FeedItem {
  id: string
  sourceId: string
  sourceName: string
  domain: DomainId
  lang: 'ko' | 'en'
  kind: 'article' | 'episode'
  deep?: boolean
  title: string
  url: string
  publishedAt: string
  excerpt: string
  audioUrl?: string
  durationSec?: number
  imageUrl?: string
}

export interface FeedFile {
  generatedAt: string | null
  domains: Domain[]
  links: Array<{ name: string; url: string; note?: string }>
  items: FeedItem[]
  report: { ok: Array<{ id: string; count: number }>; failed: Array<{ id: string; name: string; error: string }> }
}

export interface BriefItem {
  title: string
  what: string
  why: string
  next: string
  sources: Array<{ name: string; title: string; url: string; itemId: string }>
}

export interface BriefFile {
  generatedAt: string
  headline: string
  sections: Array<{ id: string; title: string; items: BriefItem[] }>
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-cache' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function loadFeed(): Promise<FeedFile | null> {
  const f = await getJson<FeedFile>('/data/feed.json')
  return f && Array.isArray(f.items) ? f : null
}

/** 브리핑은 그날 것만 씁니다. 어제 브리핑을 오늘 아침에 내밀면 안 됩니다. */
export async function loadBrief(): Promise<BriefFile | null> {
  const b = await getJson<BriefFile>('/data/brief.json')
  if (!b?.generatedAt || !Array.isArray(b.sections)) return null
  const ageHours = (Date.now() - Date.parse(b.generatedAt)) / 3_600_000
  return ageHours < 20 ? b : null
}

const HOUR = 3_600_000
export const within = (item: FeedItem, hours: number) => Date.now() - Date.parse(item.publishedAt) < hours * HOUR

export function latestPerSource(items: FeedItem[]): FeedItem[] {
  const best = new Map<string, FeedItem>()
  for (const i of items) {
    const prev = best.get(i.sourceId)
    if (!prev || i.publishedAt > prev.publishedAt) best.set(i.sourceId, i)
  }
  return [...best.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/**
 * 아침 헤드라인: 분야마다 정해진 칸 수만큼, 최근 24시간 안에서, 발행처가 겹치지 않게 고릅니다.
 * 한 발행처가 한 분야를 독차지하면 "여러 매체를 훑는다"는 의미가 사라집니다.
 */
export function pickHeadlines(feed: FeedFile): Array<{ domain: Domain; items: FeedItem[] }> {
  return feed.domains
    .filter((d) => d.morning > 0)
    .map((domain) => {
      const pool = feed.items.filter((i) => i.domain === domain.id && i.kind === 'article' && within(i, 24))
      const picked: FeedItem[] = []
      const used = new Set<string>()
      for (const i of pool) {
        if (picked.length >= domain.morning) break
        if (used.has(i.sourceId)) continue
        used.add(i.sourceId)
        picked.push(i)
      }
      // 발행처가 모자라면 같은 발행처의 다음 기사로 채웁니다.
      for (const i of pool) {
        if (picked.length >= domain.morning) break
        if (!picked.includes(i)) picked.push(i)
      }
      return { domain, items: picked }
    })
}

export function formatDuration(sec?: number): string | null {
  if (!sec) return null
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h}시간 ${m}분` : `${m}분`
}

export function relative(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  const h = Math.floor(diff / HOUR)
  if (h < 1) return '방금'
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return d === 1 ? '어제' : `${d}일 전`
}

export type Edition = 'morning' | 'evening'

export interface MustReadFile {
  edition: Edition
  generatedAt: string
  dateLine: string
  markdown: string
}

/** 아침판은 그날 오전에, 저녁판은 그날 저녁에 씁니다. 하루가 지난 글은 내밀지 않습니다. */
export async function loadMustRead(edition: Edition): Promise<MustReadFile | null> {
  const m = await getJson<MustReadFile>(`/data/mustread-${edition}.json`)
  if (!m?.generatedAt || typeof m.markdown !== 'string') return null
  const ageHours = (Date.now() - Date.parse(m.generatedAt)) / 3_600_000
  return ageHours < 26 ? m : null
}

/** 한국어 기준 분당 500자 남짓. 표와 목록이 섞여 있어 대략입니다. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500))
}
