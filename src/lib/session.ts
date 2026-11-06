import { useEffect, useState } from 'react'
import { read, todayKey, useStored, write } from './store'

/**
 * 하루 20분 루틴의 시계. 아침 10분, 저녁 10분.
 * 시간이 다 되면 목록 위에 "여기까지"가 덮입니다. 다 못 읽어도 괜찮습니다 — 끝내는 것이 목표입니다.
 */
export type SessionKind = 'morning' | 'evening'
export const SESSION_MINUTES = 10

interface Running {
  kind: SessionKind
  startedAt: number
  endsAt: number
}

/** 날짜별로 아침·저녁에 쓴 분. 지난 7일 막대에 씁니다. */
export type Log = Record<string, Partial<Record<SessionKind, number>>>

function record(kind: SessionKind, startedAt: number, endedAt: number) {
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000))
  const log = read<Log>('log', {})
  const day = todayKey(new Date(startedAt))
  const prev = log[day]?.[kind] ?? 0
  log[day] = { ...log[day], [kind]: Math.min(SESSION_MINUTES * 3, prev + minutes) }
  // 60일만 남깁니다.
  const keep = Object.keys(log).sort().slice(-60)
  write('log', Object.fromEntries(keep.map((k) => [k, log[k]])))
}

export function useSession(kind: SessionKind) {
  const [running, setRunning] = useStored<Running | null>('session', null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])

  const mine = running?.kind === kind ? running : null
  const remainingMs = mine ? Math.max(0, mine.endsAt - now) : SESSION_MINUTES * 60_000
  const finished = Boolean(mine && remainingMs === 0)

  // 다른 화면에서 끝났어도, 끝난 세션은 한 번만 기록됩니다.
  useEffect(() => {
    if (mine && finished) {
      record(kind, mine.startedAt, mine.endsAt)
      setRunning(null)
      write(`done:${kind}`, todayKey())
    }
  }, [mine, finished, kind, setRunning])

  const [doneDay] = useStored<string | null>(`done:${kind}`, null)

  return {
    active: Boolean(mine) && !finished,
    remainingMs,
    /** 오늘 이 세션을 이미 마쳤는가 */
    doneToday: doneDay === todayKey(),
    start() {
      const t = Date.now()
      setRunning({ kind, startedAt: t, endsAt: t + SESSION_MINUTES * 60_000 })
    },
    stop() {
      if (mine) record(kind, mine.startedAt, Date.now())
      setRunning(null)
      write(`done:${kind}`, todayKey())
    },
    reopen() {
      write(`done:${kind}`, null)
    },
  }
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
