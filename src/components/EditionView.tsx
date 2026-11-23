import { useState } from 'react'
import { dailyHeadlines, pickHeadlines, type Edition, type FeedItem } from '../lib/data'
import { useSession } from '../lib/session'
import { read, useReadIds, write } from '../lib/store'
import { useData } from '../lib/useData'
import { Empty, Page } from './Page'
import { EndCard, SessionBar } from './SessionBar'
import { ArticleRow } from './ArticleRow'
import { MustRead, Segments } from './MustRead'

/**
 * 아침·저녁 메뉴는 같은 네 칸입니다.
 *   Biz.Brief — 사업 아이템·돈 버는 방법 긴 글 (해외 아이템, 따라하기, AI 사업, 국내 창업)
 *   Biz.News  — 해외 아이템·국내 창업·AI·한국 산업 분야별 헤드라인
 *   All.Brief — 일반 뉴스 긴 글
 *   All.News  — 주요 일간지 헤드라인
 */
type Tab = 'biz-brief' | 'biz-news' | 'all-brief' | 'all-news'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'biz-brief', label: 'Biz.Brief' },
  { id: 'biz-news', label: 'Biz.News' },
  { id: 'all-brief', label: 'All.Brief' },
  { id: 'all-news', label: 'All.News' },
]

export function EditionView({ edition, kicker, title }: { edition: Edition; kicker: string; title: string }) {
  const session = useSession(edition)
  // 마지막에 보던 칸을 기억합니다. 아침과 저녁은 따로.
  // 예전 Inv 칸을 기억하고 있으면 Biz 칸으로 엽니다.
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = read<string>(`tab:${edition}`, 'biz-brief')
    return TABS.some((t) => t.id === saved) ? (saved as Tab) : 'biz-brief'
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    write(`tab:${edition}`, t)
  }
  const stop = () => session.active && session.stop()

  return (
    <Page kicker={kicker} title={title}>
      {session.doneToday ? (
        <EndCard
          title={edition === 'morning' ? '오늘 아침은 여기까지.' : '오늘은 여기까지.'}
          body={
            edition === 'morning'
              ? '다 못 읽었어도 괜찮습니다. 저녁에 10분이 한 번 더 있습니다.'
              : '내일 아침 브리핑이 7시 전후로 준비됩니다.'
          }
          onReopen={session.reopen}
        />
      ) : (
        <>
          <SessionBar kind={edition} session={session} />
          <Segments value={tab} onChange={setTab} options={TABS} />
          {tab === 'biz-brief' && <MustRead key="biz" edition={edition} kind="biz" onFinished={stop} />}
          {tab === 'all-brief' && <MustRead key="all" edition={edition} kind="all" onFinished={stop} />}
          {tab === 'biz-news' && <BizNews />}
          {tab === 'all-news' && <AllNews />}
        </>
      )}
    </Page>
  )
}

function useRow() {
  const [readIds, markRead] = useReadIds()
  const row = (i: FeedItem) => (
    <ArticleRow
      key={i.id}
      item={i}
      read={readIds.has(i.id)}
      onOpen={() => markRead(i.id)}
    />
  )
  return { readIds, row }
}

function Progress({ ids, readIds }: { ids: string[]; readIds: Set<string> }) {
  const n = ids.filter((id) => readIds.has(id)).length
  if (!ids.length) return null
  return (
    <>
      <p className="progress">
        {n} / {ids.length} 읽음
      </p>
      {n === ids.length && <EndCard title="다 읽었습니다." body="이 칸은 여기까지입니다." />}
    </>
  )
}

/** 분야별로 정해진 칸 수만큼. 발행처가 겹치지 않게 고릅니다. */
function BizNews() {
  const { loading, feed } = useData()
  const { readIds, row } = useRow()
  if (loading) return <Empty>불러오는 중</Empty>
  if (!feed?.generatedAt) return <Empty>아직 피드가 없습니다.</Empty>
  const groups = pickHeadlines(feed)
  const ids = groups.flatMap((g) => g.items.map((i) => i.id))
  return (
    <>
      {groups.map(({ domain, items }) =>
        items.length ? (
          <section key={domain.id} className="block">
            <h2>
              {domain.label} <small>{domain.focus}</small>
            </h2>
            {items.map(row)}
          </section>
        ) : null,
      )}
      <Progress ids={ids} readIds={readIds} />
    </>
  )
}

/** 신문사마다 최근 헤드라인 몇 개. 발췌 없이 제목만 — 훑어보는 칸입니다. */
function AllNews() {
  const { loading, feed } = useData()
  const [readIds, markRead] = useReadIds()
  if (loading) return <Empty>불러오는 중</Empty>
  const papers = feed ? dailyHeadlines(feed) : []
  if (!papers.length) return <Empty>주요 일간지 헤드라인이 아직 없습니다. 다음 피드 수집(06:30·18:30) 때 채워집니다.</Empty>
  const ids = papers.flatMap((p) => p.items.map((i) => i.id))
  return (
    <>
      {papers.map(({ source, items }) => (
        <section key={source} className="block">
          <h2>{source}</h2>
          {items.map((i) => (
            <ArticleRow key={i.id} item={i} read={readIds.has(i.id)} onOpen={() => markRead(i.id)} showExcerpt={false} showSource={false} />
          ))}
        </section>
      ))}
      <Progress ids={ids} readIds={readIds} />
    </>
  )
}
