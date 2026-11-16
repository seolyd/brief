/** 재물 탭 — 12가지 성경적 재물관 묵상과 재물 상담사. */
import { qtToday } from './qt'

export interface WealthPassage {
  ref: string
  book: string
  chapter: number
  verses: Array<[number, string]>
}

export interface WealthTopic {
  n: number
  id: string
  title: string
  short: string
  criterion: string
  passages: WealthPassage[]
  interpretation: string
  questions: string[]
  practice: string
  prayer: string
}

export interface TopicsFile {
  translation: string
  topics: WealthTopic[]
}

let cached: Promise<TopicsFile | null> | null = null
export function loadTopics(): Promise<TopicsFile | null> {
  cached ??= fetch('/wealth/topics.json')
    .then((r) => (r.ok ? (r.json() as Promise<TopicsFile>) : null))
    .catch(() => null)
  return cached
}

/**
 * 하루 한 주제씩, 12일에 한 바퀴. 첫날(2026-11-16)이 1번 주제입니다.
 * 하루는 QT 탭과 같이 한국 시간 아침 7시에 바뀝니다.
 */
const START = Date.UTC(2026, 10, 16)
export function todayIndex(): { date: string; index: number } {
  const { key } = qtToday()
  const [y, m, d] = key.split('-').map(Number)
  const days = Math.round((Date.UTC(y, m - 1, d) - START) / 86_400_000)
  return { date: key, index: ((days % 12) + 12) % 12 }
}

/** 하루 묵상 기록. 이 기기에만 남습니다. */
export interface WealthRecord {
  topicId: string
  note: string
  action: string
  done: boolean
  updatedAt: string
}

// ── 재물 상담사 ─────────────────────────────────────────────

export type CriterionStatus = '부합' | '주의' | '어긋남' | '해당 없음'

export interface CounselResult {
  summary: string
  overall: string
  criteria: Array<{ id: string; status: CriterionStatus; reason: string }>
  advice: string[]
  verses: Array<{ ref: string; why: string }>
  questions: string[]
  prayer: string
  createdAt: string
}

export interface CounselEntry {
  id: string
  text: string
  createdAt: string
  /** 앱 안에서 받은 구조화된 결과 */
  result?: CounselResult
  /** Claude 앱에서 받아 붙여 넣은 답 */
  pasted?: string
}

export async function counselStatus(): Promise<boolean> {
  try {
    const r = await fetch('/api/counsel', { cache: 'no-store' })
    if (!r.ok) return false
    return Boolean((await r.json())?.enabled)
  } catch {
    return false
  }
}

export type CounselError = 'passcode' | 'too_short' | 'too_long' | 'rate_limit' | 'refusal' | 'network' | 'server'

export async function requestCounsel(text: string, passcode: string): Promise<CounselResult | CounselError> {
  try {
    const r = await fetch('/api/counsel', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-counsel-passcode': passcode },
      body: JSON.stringify({ text }),
    })
    if (r.ok) return (await r.json()) as CounselResult
    const err = (await r.json().catch(() => ({})))?.error
    if (r.status === 401) return 'passcode'
    if (err === 'too_short' || err === 'too_long' || err === 'rate_limit' || err === 'refusal') return err
    return 'server'
  } catch {
    return 'network'
  }
}

/** API 키 없이 쓰는 길: Claude 앱에 붙여 넣을 상담 요청문. */
export function counselPrompt(topics: WealthTopic[], text: string): string {
  const criteria = topics
    .map((t) => `${t.n}. ${t.title}\n   기준: ${t.criterion}\n   말씀: ${t.passages.map((p) => p.ref).join(', ')}`)
    .join('\n')
  return `당신은 그리스도인을 위한 재물 상담사입니다. 아래 성경적 재물관 12가지 기준에 비추어 제 생각을 살피고, 목회적이고 따뜻하지만 정직하게 조언해 주세요.

[12가지 기준]
${criteria}

[답하는 방식]
1. 요약 — 제 생각을 두세 문장으로 요약하고 전체 인상(기준에 잘 부합 / 부분적으로 부합 / 다시 생각해 볼 필요)
2. 기준별 판단 — 12개 각각 '부합·주의·어긋남·해당 없음' 중 하나와 이유 한 문장 (글에 근거가 없으면 '해당 없음')
3. 조언 — 구체적인 다음 행동 3~5개
4. 관련 말씀 — 위 목록의 장절 중 2~4개와 왜 이 말씀인지
5. 돌아볼 질문 2~3개
6. 짧은 기도

정죄하지 말고, 특정 종목·상품의 매수·매도를 권하지 마세요. 재정·세무·법률 판단이 필요하면 전문가와 상의하라고 해 주세요.

[제 생각]
${text}`
}
