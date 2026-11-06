import { useEffect } from 'react'
import { pickHeadlines, type BriefItem } from '../lib/data'
import { useSession } from '../lib/session'
import { useLater, useReadIds } from '../lib/store'
import { useData } from '../lib/useData'
import { Empty, Page } from '../components/Page'
import { EndCard, SessionBar } from '../components/SessionBar'
import { ArticleRow } from '../components/ArticleRow'

const today = () =>
  new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

export function Morning() {
  const { loading, feed, brief } = useData()
  const session = useSession('morning')
  const [readIds, markRead] = useReadIds()
  const [, addLater] = useLater()

  const headlines = feed ? pickHeadlines(feed) : []
  // 브리핑이 있으면 브리핑 항목이, 없으면 헤드라인이 오늘의 "다 읽음" 기준입니다.
  const briefKeys = brief?.sections.flatMap((s) => s.items.map((i) => `brief:${brief.generatedAt}:${i.title}`)) ?? []
  const keys = brief ? briefKeys : headlines.flatMap((h) => h.items.map((i) => i.id))
  const readCount = keys.filter((k) => readIds.has(k)).length
  const allRead = keys.length > 0 && readCount === keys.length

  // 다 읽으면 타이머가 남았어도 끝냅니다. 남은 시간을 채우려 다른 걸 찾지 않게.
  useEffect(() => {
    if (allRead && session.active) session.stop()
  }, [allRead, session])

  return (
    <Page kicker={today()} title="Morning Brief">
      {session.doneToday ? (
        <EndCard
          title="오늘 아침은 여기까지."
          body="다 못 읽었어도 괜찮습니다. 저녁에 10분이 한 번 더 있습니다."
          onReopen={session.reopen}
        />
      ) : (
        <>
          <SessionBar kind="morning" session={session} />
          {keys.length > 0 && (
            <p className="progress">
              {readCount} / {keys.length} 읽음
            </p>
          )}

          {loading && <Empty>불러오는 중</Empty>}
          {!loading && !feed?.generatedAt && (
            <Empty>아직 오늘 피드가 없습니다. 매일 아침 6시 반에 GitHub Action이 채웁니다.</Empty>
          )}

          {brief ? (
            <>
              <p className="headline">{brief.headline}</p>
              {brief.sections.map((s, si) => (
                <section key={s.id} className="block">
                  <h2>
                    <span className="num">{String(si + 1).padStart(2, '0')}</span> {s.title}
                  </h2>
                  {s.items.map((item) => {
                    const key = `brief:${brief.generatedAt}:${item.title}`
                    return (
                      <BriefCard
                        key={key}
                        item={item}
                        read={readIds.has(key)}
                        onRead={() => markRead(key)}
                        onOpenSource={(id) => {
                          markRead(id)
                          markRead(key)
                        }}
                      />
                    )
                  })}
                </section>
              ))}
            </>
          ) : (
            headlines.map(({ domain, items }) =>
              items.length ? (
                <section key={domain.id} className="block">
                  <h2>
                    {domain.label} <small>{domain.focus}</small>
                  </h2>
                  {items.map((i) => (
                    <ArticleRow
                      key={i.id}
                      item={i}
                      read={readIds.has(i.id)}
                      onOpen={() => markRead(i.id)}
                      onLater={() => {
                        addLater({ url: i.url, title: i.title })
                        markRead(i.id)
                      }}
                    />
                  ))}
                </section>
              ) : null,
            )
          )}

          {allRead && <EndCard title="다 읽었습니다." body="오늘 아침은 여기까지. 앱을 닫으세요." />}
        </>
      )}
    </Page>
  )
}

function BriefCard({
  item,
  read,
  onRead,
  onOpenSource,
}: {
  item: BriefItem
  read: boolean
  onRead: () => void
  onOpenSource: (itemId: string) => void
}) {
  return (
    <article className={`brief${read ? ' read' : ''}`}>
      <h3>{item.title}</h3>
      <p>{item.what}</p>
      <dl>
        <dt>왜 중요한가</dt>
        <dd>{item.why}</dd>
        <dt>앞으로</dt>
        <dd>{item.next}</dd>
      </dl>
      <div className="sources">
        {item.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" onClick={() => onOpenSource(s.itemId)}>
            {s.name} ↗
          </a>
        ))}
        {!read && (
          <button type="button" className="link small" onClick={onRead}>
            읽음
          </button>
        )}
      </div>
    </article>
  )
}
