import { formatClock, SESSION_MINUTES, type SessionKind, useSession } from '../lib/session'

const NAME: Record<SessionKind, string> = { morning: '아침', evening: '저녁' }

export function SessionBar({ kind, session }: { kind: SessionKind; session: ReturnType<typeof useSession> }) {
  if (session.doneToday) return null
  if (!session.active) {
    return (
      <button type="button" className="session start" onClick={session.start}>
        {NAME[kind]} {SESSION_MINUTES}분 시작
        <small>시간이 다 되면 여기서 끝납니다</small>
      </button>
    )
  }
  const pct = 100 - (session.remainingMs / (SESSION_MINUTES * 60_000)) * 100
  return (
    <div className="session running" role="timer" aria-live="off">
      <div className="bar" style={{ width: `${pct}%` }} />
      <span className="clock">{formatClock(session.remainingMs)}</span>
      <button type="button" className="link" onClick={session.stop}>
        여기서 끝내기
      </button>
    </div>
  )
}

export function EndCard({ title, body, onReopen }: { title: string; body: string; onReopen?: () => void }) {
  return (
    <section className="end">
      <h2>{title}</h2>
      <p>{body}</p>
      {onReopen && (
        <button type="button" className="link quiet" onClick={onReopen}>
          목록 다시 보기
        </button>
      )}
    </section>
  )
}
