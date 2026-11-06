import { useState } from 'react'
import { formatDuration, latestPerSource, relative } from '../lib/data'
import { useReadIds } from '../lib/store'
import { useData } from '../lib/useData'
import { Empty, Page } from '../components/Page'
import { Player } from '../components/Player'

/**
 * 쇼마다 최신 회차 하나. 지난 회차를 쌓아두면 "밀린 것"이 되고, 그건 유튜브 홈과 같은 압박입니다.
 * 듣기는 타이머 밖입니다 — 출퇴근길처럼 화면을 안 보는 시간에 쓰라고 둔 칸입니다.
 */
export function Listen() {
  const { loading, feed } = useData()
  const [readIds, markRead] = useReadIds()
  const [playing, setPlaying] = useState<string | null>(null)
  const episodes = latestPerSource((feed?.items ?? []).filter((i) => i.kind === 'episode'))

  return (
    <Page kicker="화면 없이" title="Listen">
      {loading && <Empty>불러오는 중</Empty>}
      {!loading && !episodes.length && (
        <Empty>팟캐스트가 아직 없습니다. sources.json에 오디오가 있는 피드를 넣으면 여기에 나옵니다.</Empty>
      )}
      {episodes.map((ep) => (
        <article key={ep.id} className={`episode${readIds.has(ep.id) ? ' read' : ''}`}>
          <div className="ep-head">
            {ep.imageUrl && <img src={ep.imageUrl} alt="" loading="lazy" />}
            <div>
              <div className="meta">
                <span className="src">{ep.sourceName}</span>
                <span>{relative(ep.publishedAt)}</span>
                {formatDuration(ep.durationSec) && <span className="tag">{formatDuration(ep.durationSec)}</span>}
              </div>
              <p className="title">{ep.title}</p>
            </div>
          </div>
          {playing === ep.id ? (
            <Player item={ep} onEnded={() => markRead(ep.id)} />
          ) : (
            <button type="button" className="play" onClick={() => setPlaying(ep.id)}>
              재생
            </button>
          )}
        </article>
      ))}
    </Page>
  )
}
