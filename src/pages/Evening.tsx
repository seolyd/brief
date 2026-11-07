import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { within, type FeedItem } from '../lib/data'
import { useSession } from '../lib/session'
import { useLater, useReadIds } from '../lib/store'
import { useData } from '../lib/useData'
import { Empty, Page } from '../components/Page'
import { EndCard, SessionBar } from '../components/SessionBar'
import { ArticleRow } from '../components/ArticleRow'
import { MustRead, Segments } from '../components/MustRead'

const GEEK_COUNT = 5

export function Evening() {
  const { loading, feed } = useData()
  const session = useSession('evening')
  const [readIds, markRead] = useReadIds()
  const [later, addLater] = useLater()
  const [view, setView] = useState<'must' | 'list'>('must')

  const items = feed?.items ?? []
  // GeekNews는 하루 발행량이 많아서 최근 24시간 중 다섯 개만. 비는 날은 48시간까지 봅니다.
  const geek = (() => {
    const pool = items.filter((i) => i.sourceId === 'geeknews')
    const recent = pool.filter((i) => within(i, 24))
    return (recent.length >= GEEK_COUNT ? recent : pool.filter((i) => within(i, 48))).slice(0, GEEK_COUNT)
  })()
  // 심층 기사 하나. 안 읽은 것 중 가장 최근. 하나만 — 여러 개를 주면 고르느라 시간을 씁니다.
  const deep: FeedItem | undefined = items.find((i) => i.deep && i.kind === 'article' && within(i, 72) && !readIds.has(i.id))
    ?? items.find((i) => i.deep && i.kind === 'article' && within(i, 72))

  const keys = [...geek.map((i) => i.id), ...(deep ? [deep.id] : [])]
  const allRead = keys.length > 0 && keys.every((k) => readIds.has(k))
  useEffect(() => {
    if (view === 'list' && allRead && session.active) session.stop()
  }, [view, allRead, session])

  const row = (i: FeedItem) => (
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
  )

  return (
    <Page kicker="저녁 10분" title="Evening Read">
      {session.doneToday ? (
        <EndCard title="오늘은 여기까지." body="내일 아침 브리핑이 6시 반에 준비됩니다." onReopen={session.reopen} />
      ) : (
        <>
          <SessionBar kind="evening" session={session} />
          <Segments
            value={view}
            onChange={setView}
            options={[
              { id: 'must', label: 'Must Read' },
              { id: 'list', label: 'GeekNews · 심층' },
            ]}
          />

          {view === 'must' ? (
            <MustRead edition="evening" onFinished={() => session.active && session.stop()} />
          ) : (
          <>
          {loading && <Empty>불러오는 중</Empty>}

          <section className="block">
            <h2>
              GeekNews <small>흥미로운 기술 뉴스 {GEEK_COUNT}개</small>
            </h2>
            {geek.length ? geek.map(row) : !loading && <Empty>오늘 GeekNews 글이 아직 없습니다.</Empty>}
          </section>

          <section className="block">
            <h2>
              심층 기사 하나 <small>관심 산업이나 기업을 깊게</small>
            </h2>
            {deep ? row(deep) : !loading && <Empty>최근 사흘 사이 심층 기사가 없습니다.</Empty>}
          </section>

          {later.length > 0 && (
            <p className="note">
              <Link to="/later">나중에 목록</Link>에 {later.length}개가 있습니다. 주말에 한 번 몰아서 보세요.
            </p>
          )}

          {allRead && <EndCard title="다 읽었습니다." body="오늘은 여기까지. 앱을 닫으세요." />}
          </>
          )}
        </>
      )}
    </Page>
  )
}
