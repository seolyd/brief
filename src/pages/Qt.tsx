import { useEffect, useMemo, useState } from 'react'
import { Empty, Page } from '../components/Page'
import { Segments } from '../components/MustRead'
import { renderMarkdown } from '../lib/markdown'
import {
  dateLabel,
  dayOf,
  daysInMonth,
  hasRecord,
  loadBook,
  loadPlans,
  loadQt,
  monthOf,
  passageFor,
  qtToday,
  reminderIcs,
  shiftMonth,
  streak,
  versesOf,
  type BibleBook,
  type Plan,
  type PlansFile,
  type QtFile,
  type QtRecord,
} from '../lib/qt'
import { read, useStored, write } from '../lib/store'

/**
 * Daily QT. 세 칸입니다.
 *   오늘 — 본문, 해석, 묵상 질문, 그리고 나의 기록(마음에 남은 말씀 · 나의 묵상 · 나의 다짐 · 기도)
 *   기록 — 이어서 한 날, 달력, 지난 다짐
 *   이달의 QT — 이번 달 읽을 항목 고르기, 글자 크기, 아침 7시 알림
 */
type Tab = 'today' | 'records' | 'plan'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'today', label: '오늘' },
  { id: 'records', label: '기록' },
  { id: 'plan', label: '이달의 QT' },
]

type FontSize = 'm' | 'l' | 'xl'
const EMPTY_RECORD = (planId: string, ref: string): QtRecord => ({
  planId,
  ref,
  verse: '',
  meditation: '',
  resolution: '',
  prayer: '',
  done: false,
  updatedAt: '',
})

const planKey = (month: string) => `qt:plan:${month}`

/** 이번 달에 고른 항목. 아직 안 골랐으면 지난달 것을 이어서 제안만 합니다. */
function usePlanFor(month: string): [string | null, (id: string) => void] {
  const [id, setId] = useStored<string | null>(planKey(month), null)
  return [id, setId]
}

export function Qt() {
  const [{ key: today, beforeOpen }, setToday] = useState(qtToday)
  // 앱을 켜 둔 채 아침 7시를 넘기면 오늘로 넘어갑니다.
  useEffect(() => {
    const t = setInterval(() => setToday(qtToday()), 60_000)
    return () => clearInterval(t)
  }, [])

  const [tab, setTabState] = useState<Tab>(() => read<Tab>('tab:qt', 'today'))
  const setTab = (t: Tab) => {
    setTabState(t)
    write('tab:qt', t)
  }
  const [viewDate, setViewDate] = useState(today)
  useEffect(() => setViewDate(today), [today])

  const [plans, setPlans] = useState<PlansFile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    void loadPlans().then((p) => {
      setPlans(p)
      setLoading(false)
    })
  }, [])

  const [font, setFont] = useStored<FontSize>('qt:font', 'm')
  const [records, setRecords] = useStored<Record<string, QtRecord>>('qt:records', {})
  const month = monthOf(today)
  const [planId, setPlanId] = usePlanFor(month)
  const plan = plans?.plans.find((p) => p.id === planId) ?? null

  const kicker = `${dateLabel(today)}${plan ? ` · ${plan.title}` : ''}`

  if (loading) {
    return (
      <Page kicker={kicker} title="Daily QT">
        <Empty>불러오는 중</Empty>
      </Page>
    )
  }
  if (!plans) {
    return (
      <Page kicker={kicker} title="Daily QT">
        <Empty>읽기표를 불러오지 못했습니다. 연결을 확인하고 다시 열어 주세요.</Empty>
      </Page>
    )
  }

  const openDay = (date: string) => {
    setViewDate(date)
    setTab('today')
    window.scrollTo({ top: 0 })
  }

  return (
    <Page kicker={kicker} title="Daily QT">
      <Segments value={tab} onChange={setTab} options={TABS} />
      {tab === 'today' &&
        (plan ? (
          <Day
            key={`${viewDate}:${planId}`}
            date={viewDate}
            currentPlanId={planId}
            today={today}
            beforeOpen={beforeOpen && viewDate === today}
            plans={plans}
            font={font}
            record={records[viewDate]}
            onSave={(r) => setRecords((prev) => ({ ...prev, [viewDate]: r }))}
            onBackToToday={() => setViewDate(today)}
          />
        ) : (
          <>
            <p className="qt-lead">
              {dateLabel(today, { month: 'long' })}에 읽을 QT를 먼저 골라 주세요. 날짜마다 정해진 본문이 아침 7시에
              열립니다.
            </p>
            <PlanPicker plans={plans} month={month} selected={null} onPick={setPlanId} />
          </>
        ))}
      {tab === 'records' && <Records records={records} today={today} plans={plans} onOpen={openDay} />}
      {tab === 'plan' && (
        <>
          <PlanPicker plans={plans} month={month} selected={planId} onPick={setPlanId} />
          <Settings font={font} onFont={setFont} today={today} translation={plans.translation} />
        </>
      )}
    </Page>
  )
}

/** 그날 QT 한 장. 지난 날을 열면 그달에 골랐던 항목으로 보여줍니다. */
function Day({
  date,
  currentPlanId,
  today,
  beforeOpen,
  plans,
  font,
  record,
  onSave,
  onBackToToday,
}: {
  date: string
  currentPlanId: string | null
  today: string
  beforeOpen: boolean
  plans: PlansFile
  font: FontSize
  record?: QtRecord
  onSave: (r: QtRecord) => void
  onBackToToday: () => void
}) {
  // 오늘은 지금 고른 항목으로, 지난 날은 그날 기록한 항목(없으면 그달에 골랐던 항목)으로 엽니다.
  const planId =
    date === today ? currentPlanId : (record?.planId ?? read<string | null>(planKey(monthOf(date)), null))
  const plan: Plan | undefined = plans.plans.find((p) => p.id === planId)
  const passage = plan ? passageFor(plan, date) : null

  const [book, setBook] = useState<BibleBook | null>(null)
  const [qt, setQt] = useState<QtFile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!passage) return
    let alive = true
    void Promise.all([loadBook(passage.book), loadQt(date)]).then(([b, q]) => {
      if (!alive) return
      setBook(b)
      setQt(q)
      setLoading(false)
    })
    return () => {
      alive = false
    }
    // passage는 date와 plan에서 정해집니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, planId])

  const entry = plan && qt?.entries[plan.id]
  // 해석은 그날 본문에 맞춰 쓴 것만 보여줍니다. 읽기표가 바뀌어 본문이 달라졌으면 숨깁니다.
  const usable = entry && passage && entry.ref === passage.ref ? entry : null
  const verses = useMemo(() => (book && passage ? versesOf(book, passage) : []), [book, passage])
  const html = useMemo(() => (usable ? renderMarkdown(usable.interpretation) : ''), [usable])

  const [draft, setDraft] = useState<QtRecord>(() => record ?? EMPTY_RECORD(plan?.id ?? '', passage?.ref ?? ''))
  const [savedAt, setSavedAt] = useState(record?.updatedAt ?? '')
  // 적는 대로 저장합니다. 따로 저장 버튼을 누르지 않아도 사라지지 않습니다.
  const update = (patch: Partial<QtRecord>) => {
    const next = { ...draft, ...patch, planId: plan?.id ?? draft.planId, ref: passage?.ref ?? draft.ref, updatedAt: new Date().toISOString() }
    setDraft(next)
    setSavedAt(next.updatedAt)
    onSave(next)
  }

  if (!plan || !passage) {
    return <Empty>이날은 고른 QT가 없습니다.</Empty>
  }

  const isPast = date !== today
  const key = usable ? verses.find(([c, v]) => c === usable.keyVerse[0] && v === usable.keyVerse[1]) : undefined
  const verseText = (c: number, v: number, t: string) => `${book?.abbr ?? ''} ${c}:${v} ${t}`

  return (
    <div className={`qt qt-${font}`}>
      {isPast && (
        <p className="qt-note">
          {dateLabel(date)} QT입니다.{' '}
          <button type="button" className="link small" onClick={onBackToToday}>
            오늘로
          </button>
        </p>
      )}
      {beforeOpen && <p className="qt-note">오늘 QT는 아침 7시에 열립니다. 지금은 어제 QT입니다.</p>}

      <header className="qt-head">
        <p className="qt-day">
          {plan.title} · {dayOf(date)}일째
        </p>
        <h2>{passage.ref}</h2>
        {usable && <p className="qt-title">{usable.title}</p>}
      </header>

      {key && (
        <blockquote className="qt-key">
          <p>{key[2]}</p>
          <cite>
            {book?.name} {key[0]}:{key[1]}
          </cite>
        </blockquote>
      )}

      <section className="qt-block">
        <h3>말씀</h3>
        {loading && <Empty>본문을 불러오는 중</Empty>}
        {!loading && !book && <Empty>본문을 불러오지 못했습니다.</Empty>}
        <ol className="verses">
          {verses.map(([c, v, t], i) => {
            const showChapter = i === 0 || v === 1
            const picked = draft.verse === verseText(c, v, t)
            return (
              <li key={`${c}:${v}`}>
                {showChapter && passage.from[0] !== passage.to[0] && <span className="ch">{c}장</span>}
                <button
                  type="button"
                  className={`verse${picked ? ' on' : ''}`}
                  aria-pressed={picked}
                  onClick={() => update({ verse: picked ? '' : verseText(c, v, t) })}
                >
                  <sup>{v}</sup>
                  {t}
                </button>
              </li>
            )
          })}
        </ol>
        {book && <p className="qt-src">{book.translation} · 절을 누르면 마음에 남은 말씀으로 담깁니다</p>}
      </section>

      <section className="qt-block">
        <h3>해석</h3>
        {usable ? (
          <article className="prose qt-prose" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <Empty>
            {loading ? '불러오는 중' : isPast ? '이날의 해석은 남아 있지 않습니다.' : '오늘 해석은 아침 7시 전후로 준비됩니다. 먼저 말씀을 천천히 읽어 보세요.'}
          </Empty>
        )}
      </section>

      <section className="qt-block">
        <h3>묵상 질문</h3>
        <ol className="qt-questions">
          {(usable?.questions.length ? usable.questions : DEFAULT_QUESTIONS).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className="qt-block qt-record">
        <h3>나의 기록</h3>
        <label>
          <span>마음에 남은 말씀</span>
          <textarea
            rows={2}
            value={draft.verse}
            placeholder="위 본문에서 절을 누르거나 직접 적어 보세요"
            onChange={(e) => update({ verse: e.target.value })}
          />
        </label>
        <label>
          <span>나의 묵상</span>
          <textarea
            rows={4}
            value={draft.meditation}
            placeholder="이 말씀이 오늘 나에게 무엇을 말하나요?"
            onChange={(e) => update({ meditation: e.target.value })}
          />
        </label>
        <label>
          <span>나의 다짐</span>
          <textarea
            rows={3}
            value={draft.resolution}
            placeholder="오늘 하루 구체적으로 실천할 한 가지"
            onChange={(e) => update({ resolution: e.target.value })}
          />
        </label>
        <label>
          <span>기도</span>
          <textarea
            rows={3}
            value={draft.prayer}
            placeholder={usable?.prayer ?? '오늘 말씀을 붙들고 드리는 기도'}
            onChange={(e) => update({ prayer: e.target.value })}
          />
        </label>
        {usable && !draft.prayer && <p className="qt-src">함께 드리는 기도: {usable.prayer}</p>}
        <p className="qt-saved">{savedAt ? `${new Date(savedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 저장됨 · 이 기기에만 남습니다` : '적는 대로 이 기기에 저장됩니다'}</p>
        {draft.done ? (
          <p className="mr-done">
            {isPast ? '이날 묵상을 마쳤습니다.' : '오늘 묵상을 마쳤습니다.'}{' '}
            <button type="button" className="link small" onClick={() => void copy(passage.ref, draft)}>
              기록 복사
            </button>
          </p>
        ) : (
          <button type="button" className="finish" onClick={() => update({ done: true })}>
            {isPast ? '이날 묵상 마치기' : '오늘 묵상 마치기'}
          </button>
        )}
      </section>
    </div>
  )
}

const DEFAULT_QUESTIONS = [
  '이 본문에서 하나님은 어떤 분으로 드러나나요?',
  '오늘 내 삶에서 붙들고 순종할 말씀은 무엇인가요?',
]

async function copy(ref: string, r: QtRecord) {
  const text = [
    `[QT] ${ref}`,
    r.verse && `· 말씀: ${r.verse}`,
    r.meditation && `· 묵상: ${r.meditation}`,
    r.resolution && `· 다짐: ${r.resolution}`,
    r.prayer && `· 기도: ${r.prayer}`,
  ]
    .filter(Boolean)
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
    alert('기록을 복사했습니다.')
  } catch {
    window.prompt('아래 글을 복사하세요', text)
  }
}

function PlanPicker({
  plans,
  month,
  selected,
  onPick,
}: {
  plans: PlansFile
  month: string
  selected: string | null
  onPick: (id: string) => void
}) {
  const last = read<string | null>(planKey(shiftMonth(month, -1)), null)
  const n = String(daysInMonth(month))
  return (
    <section className="qt-block">
      <h3>{Number(month.slice(5))}월의 QT</h3>
      <ul className="plans">
        {plans.plans.map((p) => {
          const on = p.id === selected
          const sample = p.days[n].slice(0, 3).map((s) => s.ref)
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`plan${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  if (on) return
                  if (selected && !window.confirm(`이번 달 QT를 '${p.title}'(으)로 바꿀까요? 지난 기록은 그대로 남습니다.`)) return
                  onPick(p.id)
                }}
              >
                <span className="plan-title">
                  {p.title}
                  {on && <em>이번 달</em>}
                  {!on && !selected && p.id === last && <em className="soft">지난달</em>}
                </span>
                <span className="plan-sum">{p.summary}</span>
                <span className="plan-sample">
                  {sample.join(' → ')} … ({n}일)
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Settings({
  font,
  onFont,
  today,
  translation,
}: {
  font: FontSize
  onFont: (f: FontSize) => void
  today: string
  translation: string
}) {
  const addReminder = () => {
    const blob = new Blob([reminderIcs(`${location.origin}/qt`, today)], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'daily-qt-0700.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }
  return (
    <>
      <section className="qt-block">
        <h3>글자 크기</h3>
        <Segments
          value={font}
          onChange={onFont}
          options={[
            { id: 'm', label: '보통' },
            { id: 'l', label: '크게' },
            { id: 'xl', label: '아주 크게' },
          ]}
        />
      </section>
      <section className="qt-block">
        <h3>아침 7시 알림</h3>
        <p className="qt-lead">
          매일 아침 7시에 울리는 반복 일정을 휴대폰 캘린더에 넣습니다. 알림을 누르면 이 화면이 열립니다.
        </p>
        <button type="button" className="play" onClick={addReminder}>
          캘린더에 7시 알림 추가
        </button>
      </section>
      <p className="note">
        본문: {translation}. 해석과 묵상 질문은 AI가 본문을 바탕으로 쓴 묵상 도움글입니다. 교회의 가르침과 함께
        분별해서 읽어 주세요.
      </p>
    </>
  )
}

function Records({
  records,
  today,
  plans,
  onOpen,
}: {
  records: Record<string, QtRecord>
  today: string
  plans: PlansFile
  onOpen: (date: string) => void
}) {
  const [month, setMonth] = useState(monthOf(today))
  const n = daysInMonth(month)
  const firstWeekday = new Date(`${month}-01T12:00:00+09:00`).getDay()
  const done = Object.keys(records).filter((d) => hasRecord(records[d]))
  const inMonth = done.filter((d) => d.startsWith(month)).length
  const list = done.sort().reverse()
  const planTitle = (id: string) => plans.plans.find((p) => p.id === id)?.title ?? ''

  return (
    <>
      <div className="qt-stats">
        <div>
          <strong>{streak(records, today)}</strong>
          <span>일 연속</span>
        </div>
        <div>
          <strong>{inMonth}</strong>
          <span>
            {Number(month.slice(5))}월 묵상 / {n}일
          </span>
        </div>
        <div>
          <strong>{done.length}</strong>
          <span>모든 기록</span>
        </div>
      </div>

      <section className="qt-block">
        <h3 className="cal-head">
          <button type="button" className="link small" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span>{month.replace('-', '년 ')}월</span>
          <button
            type="button"
            className="link small"
            aria-label="다음 달"
            disabled={month >= monthOf(today)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </h3>
        <div className="cal">
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <span key={w} className="cal-w">
              {w}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`
            const future = date > today
            const has = hasRecord(records[date])
            const canOpen = !future && (has || read<string | null>(planKey(month), null) != null)
            return (
              <button
                key={date}
                type="button"
                className={`cal-d${has ? ' has' : ''}${date === today ? ' today' : ''}`}
                disabled={!canOpen}
                onClick={() => onOpen(date)}
                aria-label={`${i + 1}일${has ? ' 기록 있음' : ''}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </section>

      <section className="qt-block">
        <h3>나의 다짐</h3>
        {!list.length && <Empty>아직 기록이 없습니다. 오늘 말씀 아래에 한 줄을 적어 보세요.</Empty>}
        <ul className="qt-list">
          {list.map((d) => {
            const r = records[d]
            return (
              <li key={d}>
                <button type="button" onClick={() => onOpen(d)}>
                  <span className="meta">
                    <span className="src">{dateLabel(d, { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                    <span>{r.ref}</span>
                    <span>{planTitle(r.planId)}</span>
                  </span>
                  <span className="title">{r.resolution || r.meditation || r.verse || '묵상을 마쳤습니다'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
