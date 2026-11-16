import { useEffect, useMemo, useState } from 'react'
import { Empty, Page } from '../components/Page'
import { Segments } from '../components/MustRead'
import { renderMarkdown } from '../lib/markdown'
import { dateLabel } from '../lib/qt'
import { read, useStored, write } from '../lib/store'
import {
  counselPrompt,
  counselStatus,
  loadTopics,
  requestCounsel,
  todayIndex,
  type CounselEntry,
  type CounselError,
  type CounselResult,
  type TopicsFile,
  type WealthRecord,
  type WealthTopic,
} from '../lib/wealth'

/**
 * 재물. 세 칸입니다.
 *   오늘 묵상 — 12주제를 하루 하나씩: 본문 → 해석 → 삶의 적용 → 실천 과제 → 기도문, 그리고 나의 묵상
 *   12가지   — 주제 전체 목록과 각 주제의 말씀
 *   재물 상담 — 내 생각을 적으면 Claude가 12가지 기준에 비추어 조언
 */
type Tab = 'today' | 'topics' | 'counsel'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'today', label: '오늘 묵상' },
  { id: 'topics', label: '12가지' },
  { id: 'counsel', label: '재물 상담' },
]

export function Wealth() {
  const [tab, setTabState] = useState<Tab>(() => read<Tab>('tab:wealth', 'today'))
  const setTab = (t: Tab) => {
    setTabState(t)
    write('tab:wealth', t)
  }
  const [file, setFile] = useState<TopicsFile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    void loadTopics().then((f) => {
      setFile(f)
      setLoading(false)
    })
  }, [])

  return (
    <Page kicker="성경적 재물관" title="재물">
      <Segments value={tab} onChange={setTab} options={TABS} />
      {loading && <Empty>불러오는 중</Empty>}
      {!loading && !file && <Empty>주제를 불러오지 못했습니다.</Empty>}
      {file && tab === 'today' && <Today file={file} />}
      {file && tab === 'topics' && <Topics file={file} />}
      {file && tab === 'counsel' && <Counsel file={file} />}
    </Page>
  )
}

// ── 오늘 묵상 ─────────────────────────────────────────────

function Today({ file }: { file: TopicsFile }) {
  const [{ date, index }, setToday] = useState(todayIndex)
  useEffect(() => {
    const t = setInterval(() => setToday(todayIndex()), 60_000)
    return () => clearInterval(t)
  }, [])
  const topic = file.topics[index]
  const [records, setRecords] = useStored<Record<string, WealthRecord>>('wealth:records', {})
  const rec: WealthRecord = records[date] ?? { topicId: topic.id, note: '', action: '', done: false, updatedAt: '' }
  const update = (patch: Partial<WealthRecord>) =>
    setRecords((prev) => ({
      ...prev,
      [date]: { ...rec, ...prev[date], ...patch, topicId: topic.id, updatedAt: new Date().toISOString() },
    }))
  const doneDays = Object.values(records).filter((r) => r.done).length

  return (
    <>
      <p className="qt-lead">
        {dateLabel(date)} · {topic.n}/12번째 주제 · 마친 날 {doneDays}일
      </p>
      <TopicBody topic={topic} translation={file.translation} />

      <section className="qt-block qt-record">
        <h3>나의 묵상</h3>
        <label>
          <span>오늘 말씀이 내 경제생활에 말하는 것</span>
          <textarea rows={4} value={rec.note} onChange={(e) => update({ note: e.target.value })} />
        </label>
        <label>
          <span>오늘의 실천</span>
          <textarea rows={2} value={rec.action} placeholder={topic.practice} onChange={(e) => update({ action: e.target.value })} />
        </label>
        <p className="qt-saved">적는 대로 이 기기에 저장됩니다. 다음 주제는 내일 아침 7시에 열립니다.</p>
        {rec.done ? (
          <p className="mr-done">오늘 재물 묵상을 마쳤습니다.</p>
        ) : (
          <button type="button" className="finish" onClick={() => update({ done: true })}>
            묵상을 마쳤습니다
          </button>
        )}
      </section>
    </>
  )
}

/** 주제 하나: 본문 → 해석 → 삶의 적용 → 실천 과제 → 기도문. */
function TopicBody({ topic, translation }: { topic: WealthTopic; translation: string }) {
  const html = useMemo(() => renderMarkdown(topic.interpretation), [topic])
  return (
    <>
      <header className="qt-head">
        <p className="qt-day">{topic.short}</p>
        <h2>{topic.title}</h2>
        <p className="qt-title">{topic.criterion}</p>
      </header>

      <section className="qt-block">
        <h3>성경 본문</h3>
        {topic.passages.map((p) => (
          <div key={p.ref} className="w-passage">
            <p className="w-ref">{p.ref}</p>
            <ol className="verses">
              {p.verses.map(([v, t]) => (
                <li key={v} className="verse">
                  <sup>{v}</sup>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <p className="qt-src">{translation}</p>
      </section>

      <section className="qt-block">
        <h3>해석</h3>
        <article className="prose qt-prose" dangerouslySetInnerHTML={{ __html: html }} />
      </section>

      <section className="qt-block">
        <h3>삶의 적용</h3>
        <ol className="qt-questions">
          {topic.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className="qt-block">
        <h3>실천 과제</h3>
        <p className="w-practice">{topic.practice}</p>
      </section>

      <section className="qt-block">
        <h3>기도문</h3>
        <p className="w-prayer">{topic.prayer}</p>
      </section>
    </>
  )
}

// ── 12가지 ─────────────────────────────────────────────

function Topics({ file }: { file: TopicsFile }) {
  const [open, setOpen] = useState<string | null>(null)
  const { index } = todayIndex()
  const topic = file.topics.find((t) => t.id === open)
  if (topic) {
    return (
      <>
        <button type="button" className="link" onClick={() => setOpen(null)}>
          ← 12가지 목록
        </button>
        <TopicBody topic={topic} translation={file.translation} />
      </>
    )
  }
  return (
    <ul className="plans w-topics">
      {file.topics.map((t, i) => (
        <li key={t.id}>
          <button type="button" className={`plan${i === index ? ' on' : ''}`} onClick={() => setOpen(t.id)}>
            <span className="plan-title">
              {t.n}. {t.title}
              {i === index && <em>오늘</em>}
            </span>
            <span className="plan-sum">{t.criterion}</span>
            <span className="plan-sample">{t.passages.map((p) => p.ref).join(' · ')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── 재물 상담 ─────────────────────────────────────────────

const ERROR_TEXT: Record<CounselError, string> = {
  passcode: '상담 암호가 맞지 않습니다. 다시 입력해 주세요.',
  too_short: '조금 더 자세히 적어 주세요 (10자 이상).',
  too_long: '4,000자 이내로 줄여 주세요.',
  rate_limit: '요청이 많아 잠시 막혔습니다. 조금 뒤에 다시 해 주세요.',
  refusal: '이 내용으로는 상담을 만들지 못했습니다. 표현을 바꿔 다시 해 주세요.',
  network: '네트워크에 연결되지 않았습니다.',
  server: '상담을 만들지 못했습니다. 잠시 뒤 다시 해 주세요.',
}

const STATUS_CLASS: Record<string, string> = { 부합: 'ok', 주의: 'warn', 어긋남: 'bad', '해당 없음': 'na' }

function Counsel({ file }: { file: TopicsFile }) {
  const [text, setText] = useStored<string>('wealth:draft', '')
  const [history, setHistory] = useStored<CounselEntry[]>('wealth:counsel', [])
  const [passcode, setPasscode] = useStored<string>('wealth:passcode', '')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needPass, setNeedPass] = useState(false)
  const [passInput, setPassInput] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pasteFor, setPasteFor] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    void counselStatus().then(setEnabled)
  }, [])

  const save = (entry: CounselEntry) => setHistory((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 30))

  async function ask(code = passcode) {
    if (!code) {
      setNeedPass(true)
      return
    }
    setBusy(true)
    setError(null)
    const r = await requestCounsel(text.trim(), code)
    setBusy(false)
    if (typeof r === 'string') {
      if (r === 'passcode') {
        setPasscode('')
        setNeedPass(true)
      }
      setError(ERROR_TEXT[r])
      return
    }
    const entry: CounselEntry = { id: crypto.randomUUID(), text: text.trim(), createdAt: r.createdAt, result: r }
    save(entry)
    setText('')
    setViewing(entry.id)
  }

  async function viaClaudeApp() {
    const prompt = counselPrompt(file.topics, text.trim())
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setCopied(false)
    }
    const entry: CounselEntry = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() }
    save(entry)
    setPasteFor(entry.id)
    setText('')
    window.open('https://claude.ai/new', '_blank', 'noopener')
  }

  const current = history.find((e) => e.id === viewing)
  if (current) {
    return (
      <>
        <button type="button" className="link" onClick={() => setViewing(null)}>
          ← 상담 목록
        </button>
        <CounselView entry={current} file={file} />
      </>
    )
  }

  const ready = text.trim().length >= 10

  return (
    <>
      <p className="qt-lead">
        고민하는 지출, 투자, 빚, 헌금, 일, 돈에 대한 마음을 적어 주세요. Claude가 12가지 성경적 재물관 기준에 비추어
        부합하는지 살피고 조언합니다.
      </p>

      <section className="qt-block qt-record">
        <label>
          <span>나의 생각 · 상황</span>
          <textarea
            rows={7}
            value={text}
            maxLength={4000}
            placeholder="예) 보너스 1,000만 원이 생겼습니다. 절반은 레버리지 ETF에 넣고 나머지로 차를 바꾸려 합니다. 헌금은 따로 생각하지 않았습니다."
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="qt-saved">{text.length.toLocaleString()} / 4,000자 · 상담 기록은 이 기기에만 남습니다</p>

        {enabled === null && <Empty>상담 방식을 확인하는 중</Empty>}

        {enabled && (
          <>
            {needPass && (
              <label>
                <span>상담 암호 (Vercel에 넣은 COUNSEL_PASSCODE)</span>
                <input
                  className="w-input"
                  type="password"
                  value={passInput}
                  autoComplete="off"
                  onChange={(e) => setPassInput(e.target.value)}
                />
              </label>
            )}
            <button
              type="button"
              className="finish"
              disabled={!ready || busy || (needPass && !passInput)}
              onClick={() => {
                if (needPass) {
                  setPasscode(passInput)
                  setNeedPass(false)
                  void ask(passInput)
                } else void ask()
              }}
            >
              {busy ? 'Claude가 살피는 중… (30초 안팎)' : '상담받기'}
            </button>
          </>
        )}

        {enabled === false && (
          <>
            <button type="button" className="finish" disabled={!ready} onClick={() => void viaClaudeApp()}>
              Claude 앱에서 상담받기
            </button>
            <p className="qt-src">
              상담 요청문이 복사되고 Claude가 열립니다. 새 대화에 붙여 넣으면 12가지 기준으로 답합니다. API 키 없이 Claude
              구독으로 돌아갑니다. 앱 안에서 바로 결과를 보려면 Vercel에 ANTHROPIC_API_KEY와 COUNSEL_PASSCODE를 넣으세요.
            </p>
          </>
        )}
        {error && <p className="w-error">{error}</p>}
      </section>

      {pasteFor && (
        <section className="qt-block qt-record">
          <h3>Claude의 답 저장 (선택)</h3>
          <p className="qt-src">{copied ? '요청문을 복사했습니다. ' : '복사가 막혀 있으면 위 글을 직접 붙여 넣으세요. '}받은 답을 여기에 붙여 넣으면 기록에 남습니다.</p>
          <textarea rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
          <button
            type="button"
            className="finish"
            disabled={!pasteText.trim()}
            onClick={() => {
              const entry = history.find((e) => e.id === pasteFor)
              if (entry) save({ ...entry, pasted: pasteText.trim() })
              setPasteFor(null)
              setPasteText('')
            }}
          >
            답 저장
          </button>
        </section>
      )}

      {history.length > 0 && (
        <section className="qt-block">
          <h3>지난 상담</h3>
          <ul className="qt-list w-history">
            {history.map((e) => (
              <li key={e.id}>
                <button type="button" className="w-item" onClick={() => setViewing(e.id)}>
                  <span className="w-item-date">
                    {new Date(e.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    {e.result ? ` · ${e.result.overall}` : e.pasted ? ' · Claude 앱 답' : ' · 답 없음'}
                  </span>
                  <span className="w-item-text">{e.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="link quiet"
            onClick={() => {
              if (window.confirm('상담 기록을 모두 지울까요?')) setHistory([])
            }}
          >
            기록 모두 지우기
          </button>
        </section>
      )}
    </>
  )
}

function CounselView({ entry, file }: { entry: CounselEntry; file: TopicsFile }) {
  const verseText = (ref: string) => file.topics.flatMap((t) => t.passages).find((p) => p.ref === ref)
  const pastedHtml = useMemo(() => (entry.pasted ? renderMarkdown(entry.pasted) : ''), [entry.pasted])
  const r: CounselResult | undefined = entry.result

  return (
    <>
      <section className="qt-block">
        <h3>나의 생각</h3>
        <p className="w-quote">{entry.text}</p>
      </section>

      {!r && entry.pasted && (
        <section className="qt-block">
          <h3>Claude의 답</h3>
          <article className="prose qt-prose" dangerouslySetInnerHTML={{ __html: pastedHtml }} />
        </section>
      )}
      {!r && !entry.pasted && <Empty>저장된 답이 없습니다. Claude 앱에서 받은 답을 다음에는 붙여 넣어 보세요.</Empty>}

      {r && (
        <>
          <section className="qt-block">
            <h3>종합</h3>
            <p className={`w-overall w-${r.overall === '기준에 잘 부합' ? 'ok' : r.overall === '부분적으로 부합' ? 'warn' : 'bad'}`}>{r.overall}</p>
            <p>{r.summary}</p>
          </section>

          <section className="qt-block">
            <h3>12가지 기준</h3>
            <ul className="w-criteria">
              {r.criteria.map((c) => {
                const t = file.topics.find((x) => x.id === c.id)
                return (
                  <li key={c.id} className={`w-c w-${STATUS_CLASS[c.status] ?? 'na'}`}>
                    <span className="w-badge">{c.status}</span>
                    <div>
                      <strong>
                        {t?.n}. {t?.short}
                      </strong>
                      {c.reason && <p>{c.reason}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="qt-block">
            <h3>조언</h3>
            <ol className="qt-questions">
              {r.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </section>

          {r.verses.length > 0 && (
            <section className="qt-block">
              <h3>관련 말씀</h3>
              {r.verses.map((v) => {
                const p = verseText(v.ref)
                return (
                  <blockquote key={v.ref} className="qt-key">
                    {p?.verses.map(([n, t]) => (
                      <p key={n}>
                        <sup className="w-sup">{n}</sup>
                        {t}
                      </p>
                    ))}
                    <cite>
                      {v.ref} · {v.why}
                    </cite>
                  </blockquote>
                )
              })}
              <p className="qt-src">{file.translation}</p>
            </section>
          )}

          <section className="qt-block">
            <h3>돌아볼 질문</h3>
            <ol className="qt-questions">
              {r.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>

          <section className="qt-block">
            <h3>기도</h3>
            <p className="w-prayer">{r.prayer}</p>
          </section>

          <p className="qt-src">
            Claude가 쓴 신앙적 조언입니다. 특정 상품의 매수·매도 권유가 아니며, 재정·세무·법률 판단은 전문가와 상의하세요.
          </p>
        </>
      )}
    </>
  )
}
