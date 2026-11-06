import { SESSION_MINUTES, type Log } from '../lib/session'
import { todayKey, useStored } from '../lib/store'
import { useData } from '../lib/useData'
import { Page } from '../components/Page'

/** 유튜브 접근 방식 바꾸기. 뉴스 앱으로 옮겨도 무한 스크롤에 빠지면 같은 일이 반복됩니다. */
const STEPS = [
  { id: 'home', text: '유튜브 앱을 아이폰 첫 화면에서 뺐다' },
  { id: 'notif', text: '유튜브 알림을 모두 껐다' },
  { id: 'autoplay', text: '유튜브 자동재생을 껐다' },
  { id: 'brief', text: '이 앱을 유튜브가 있던 자리에 뒀다' },
  { id: 'later', text: '궁금한 영상은 바로 보지 않고 ‘나중에’에 넣는다' },
]

export function Habits() {
  const [checked, setChecked] = useStored<string[]>('habits', [])
  const [log] = useStored<Log>('log', {})
  const { feed } = useData()

  const days = Array.from({ length: 7 }, (_, n) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - n))
    const key = todayKey(d)
    return { key, label: d.toLocaleDateString('ko-KR', { weekday: 'narrow' }), m: log[key]?.morning ?? 0, e: log[key]?.evening ?? 0 }
  })
  const total = days.reduce((n, d) => n + d.m + d.e, 0)
  const max = SESSION_MINUTES * 2

  return (
    <Page kicker="하루 20분" title="Habits">
      <section className="block">
        <h2>
          지난 7일 <small>합계 {total}분</small>
        </h2>
        <div className="week" aria-label="지난 7일 사용 시간">
          {days.map((d) => (
            <div key={d.key} className="day">
              <div className="stack" title={`아침 ${d.m}분 · 저녁 ${d.e}분`}>
                <span className="e" style={{ height: `${Math.min(100, (d.e / max) * 100)}%` }} />
                <span className="m" style={{ height: `${Math.min(100, (d.m / max) * 100)}%` }} />
              </div>
              <span className="lbl">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="legend">
          <i className="m" /> 아침 <i className="e" /> 저녁 · 막대 끝이 20분입니다
        </p>
      </section>

      <section className="block">
        <h2>유튜브 접근 방식 바꾸기</h2>
        <ul className="checks">
          {STEPS.map((s) => {
            const on = checked.includes(s.id)
            return (
              <li key={s.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setChecked((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                  />
                  <span>{s.text}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      {feed?.links?.length ? (
        <section className="block">
          <h2>
            직접 가는 곳 <small>앱 대신 브라우저 즐겨찾기로</small>
          </h2>
          <ul className="links">
            {feed.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.name} ↗
                </a>
                {l.note && <span>{l.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feed && (
        <p className="note">
          {feed.generatedAt
            ? `피드 갱신 ${new Date(feed.generatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : '피드가 아직 생성되지 않았습니다.'}
          {feed.report.failed.length > 0 && ` · 응답 없는 소스: ${feed.report.failed.map((f) => f.name).join(', ')}`}
        </p>
      )}
    </Page>
  )
}
