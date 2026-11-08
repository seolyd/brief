import type { FeedItem } from '../lib/data'
import { relative } from '../lib/data'

export function ArticleRow({
  item,
  read,
  onOpen,
  onLater,
  showExcerpt = true,
  showSource = true,
}: {
  item: FeedItem
  read: boolean
  onOpen: () => void
  onLater?: () => void
  showExcerpt?: boolean
  /** 신문사별로 묶인 목록에서는 머리에 이름이 있으니 줄마다 반복하지 않습니다. */
  showSource?: boolean
}) {
  return (
    <article className={`row${read ? ' read' : ''}`}>
      <div className="meta">
        {showSource && <span className="src">{item.sourceName}</span>}
        <span>{relative(item.publishedAt)}</span>
        {item.lang === 'en' && <span className="tag">EN</span>}
      </div>
      <a href={item.url} target="_blank" rel="noreferrer noopener" onClick={onOpen} className="title">
        {item.title}
      </a>
      {showExcerpt && item.excerpt && <p className="excerpt">{item.excerpt}</p>}
      {onLater && (
        <button type="button" className="link small" onClick={onLater}>
          나중에 읽기
        </button>
      )}
    </article>
  )
}
