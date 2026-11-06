/**
 * sources.json의 RSS/Atom을 모아 public/data/feed.json 하나로 씁니다.
 * GitHub Action이 매일 아침 돌리고, 앱은 같은 출처의 이 파일만 읽습니다 — 서버도 CORS도 없습니다.
 *
 *  - 제목·링크·날짜·짧은 발췌만 담습니다. 읽기는 원문으로 보냅니다.
 *  - 오디오 첨부(enclosure)가 있는 항목은 episode입니다. 팟캐스트도 소스 한 줄로 끝납니다.
 *  - 한 소스가 죽어도 나머지는 갱신하고, 죽은 소스는 지난 항목을 유지한 채 report.failed에 남깁니다.
 */
import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const PER_SOURCE = 10
const MAX_AGE_DAYS = 7
const TIMEOUT_MS = 20_000

const CONFIG_PATH = process.env.FEED_SOURCES ?? 'sources.json'
const OUT_PATH = process.env.FEED_OUT ?? 'public/data/feed.json'

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
// 엔티티가 많은 피드가 파서 한도에 걸려 통째로 실패하지 않게, 엔티티는 직접 풉니다.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: false })

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const textOf = (v) => (v && typeof v === 'object' ? (v['#text'] ?? '') : (v ?? ''))

/** 엔티티를 먼저 풀고 태그를 벗깁니다. &amp;는 마지막 — &amp;lt;가 태그로 살아나지 않게. */
function stripHtml(s) {
  return String(textOf(s))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerpt(s, max = 240) {
  const flat = stripHtml(s)
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** itunes:duration은 "3600" · "45:30" · "1:02:03" 셋 중 하나로 옵니다. */
function parseDuration(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (/^\d+$/.test(raw)) return Number(raw)
  const parts = raw.split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return undefined
  const sec = parts.reduce((acc, p) => acc * 60 + p, 0)
  return sec > 0 ? sec : undefined
}

function pickAudio(item) {
  const encs = asArray(item.enclosure)
  const byType = encs.find((e) => String(e?.['@_type'] ?? '').startsWith('audio'))
  const byExt = encs.find((e) => /\.(mp3|m4a|aac|ogg)(\?|$)/i.test(String(e?.['@_url'] ?? '')))
  return (byType ?? byExt)?.['@_url'] || undefined
}

function pickLink(entry) {
  if (typeof entry.link === 'string') return entry.link
  const links = asArray(entry.link)
  const alt = links.find((l) => l?.['@_rel'] === 'alternate' && l?.['@_href'])
  return alt?.['@_href'] ?? links.find((l) => l?.['@_href'])?.['@_href'] ?? textOf(entry.id)
}

function toISO(value) {
  const d = new Date(textOf(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function readItems(xml) {
  const doc = parser.parse(xml)
  const channel = doc?.rss?.channel ?? doc?.['rdf:RDF']
  const rss = asArray(channel?.item ?? doc?.['rdf:RDF']?.item)
  if (rss.length) {
    const showImage = channel?.['itunes:image']?.['@_href'] ?? channel?.image?.url
    return rss.map((i) => {
      const audioUrl = pickAudio(i)
      const guid = textOf(i.guid).trim()
      const link = typeof i.link === 'string' ? i.link.trim() : pickLink(i)
      return {
        title: stripHtml(i.title),
        // 모든 회차의 link가 쇼 홈페이지인 피드가 있어서, 회차 주소를 link → guid → 오디오 순으로 찾습니다.
        url: link || (/^https?:\/\//.test(guid) ? guid : '') || audioUrl || '',
        uid: guid || link || audioUrl || '',
        publishedAt: toISO(i.pubDate ?? i['dc:date']),
        excerpt: excerpt(i.description ?? i['content:encoded'] ?? i['itunes:summary']),
        ...(audioUrl
          ? {
              audioUrl,
              durationSec: parseDuration(i['itunes:duration']),
              imageUrl: i['itunes:image']?.['@_href'] ?? showImage,
            }
          : {}),
      }
    })
  }
  return asArray(doc?.feed?.entry).map((e) => {
    const link = pickLink(e)
    return {
      title: stripHtml(e.title),
      url: link,
      uid: textOf(e.id) || link,
      publishedAt: toISO(e.published ?? e.updated),
      excerpt: excerpt(e.summary ?? e.content),
    }
  })
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const parsed = readItems(await res.text())
  if (!parsed.length) throw new Error('no items parsed')

  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
  const usable = parsed
    .filter((i) => i.title && i.url)
    .map((i) => ({ ...i, publishedAt: i.publishedAt ?? new Date().toISOString() }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  // 팟캐스트는 주간 쇼도 있어서 날짜로 자르지 않습니다. 최신 회차가 일주일 넘게 묵어도 보여야 합니다.
  const fresh = usable.filter((i) => i.audioUrl || Date.parse(i.publishedAt) >= cutoff)

  const seen = new Map()
  for (const i of fresh) seen.set(i.url, (seen.get(i.url) ?? 0) + 1)
  const rows = fresh.slice(0, PER_SOURCE).map((i) => ({
    // 앱이 읽음 상태를 이 id로 붙듭니다. 주소가 겹칠 때만 guid로 갈라냅니다.
    id: `${source.id}:${seen.get(i.url) > 1 ? i.uid : i.url}`,
    sourceId: source.id,
    sourceName: source.name,
    domain: source.domain,
    ...(source.deep ? { deep: true } : {}),
    lang: source.lang === 'ko' ? 'ko' : 'en',
    kind: i.audioUrl ? 'episode' : 'article',
    title: i.title,
    url: i.url,
    publishedAt: i.publishedAt,
    excerpt: i.excerpt,
    ...(i.audioUrl ? { audioUrl: i.audioUrl } : {}),
    ...(i.durationSec ? { durationSec: i.durationSec } : {}),
    ...(i.imageUrl ? { imageUrl: i.imageUrl } : {}),
  }))
  return { rows, parsed: parsed.length }
}

const previous = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : { items: [] }

const results = await Promise.all(
  config.sources.map(async (source) => {
    try {
      const { rows, parsed } = await fetchSource(source)
      return { source, rows, parsed }
    } catch (err) {
      return { source, error: err instanceof Error ? err.message : String(err) }
    }
  }),
)

const ok = results.filter((r) => r.rows)
const failed = results.filter((r) => r.error)
const failedIds = new Set(failed.map((r) => r.source.id))
const kept = (previous.items ?? []).filter((i) => failedIds.has(i.sourceId))

// 같은 기사가 여러 섹션 피드에 실리는 일이 잦아서 주소로도 거릅니다.
const seenKeys = new Set()
const items = [...ok.flatMap((r) => r.rows), ...kept]
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .filter((item) => {
    if (seenKeys.has(item.id) || seenKeys.has(item.url)) return false
    seenKeys.add(item.id)
    seenKeys.add(item.url)
    return true
  })

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(
  OUT_PATH,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      domains: config.domains ?? [],
      links: config.links ?? [],
      items,
      report: {
        ok: ok.map((r) => ({ id: r.source.id, count: r.rows.length, parsed: r.parsed })),
        failed: failed.map((r) => ({ id: r.source.id, name: r.source.name, url: r.source.url, error: r.error })),
      },
    },
    null,
    2,
  )}\n`,
)

const episodes = items.filter((i) => i.kind === 'episode').length
console.log(`${items.length} items (${episodes} episodes) from ${ok.length}/${config.sources.length} sources`)
for (const r of ok) if (!r.rows.length) console.warn(`  EMPTY ${r.source.id}: ${r.parsed} parsed, none in the last ${MAX_AGE_DAYS} days`)
for (const r of failed) console.warn(`  FAILED ${r.source.id} (${r.source.url}): ${r.error}`)
if (!ok.length) {
  console.error(`every source failed — check ${CONFIG_PATH}`)
  process.exit(1)
}
