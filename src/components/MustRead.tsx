import { useEffect, useMemo, useState } from 'react'
import { loadMustRead, readingMinutes, type Edition, type MustReadFile } from '../lib/data'
import { renderMarkdown } from '../lib/markdown'
import { useReadIds } from '../lib/store'
import { Empty } from './Page'

/**
 * 큐레이션된 긴 글 한 편. 하루 두 번(아침·저녁) GitHub Action이 씁니다.
 * 끝까지 내려오면 "다 읽음" 하나만 있습니다. 다음 글을 이어 붙이지 않습니다.
 */
export function MustRead({ edition, onFinished }: { edition: Edition; onFinished: () => void }) {
  const [doc, setDoc] = useState<MustReadFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [readIds, markRead] = useReadIds()

  useEffect(() => {
    let alive = true
    void loadMustRead(edition).then((m) => {
      if (!alive) return
      setDoc(m)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [edition])

  const html = useMemo(() => (doc ? renderMarkdown(doc.markdown) : ''), [doc])

  if (loading) return <Empty>불러오는 중</Empty>
  if (!doc) {
    return (
      <Empty>
        {edition === 'morning' ? '오늘 아침' : '오늘 저녁'} Must Read가 아직 없습니다.{' '}
        {edition === 'morning' ? '매일 06:30' : '매일 18:30'}에 준비됩니다. 처음이라면 저장소 Secret에
        ANTHROPIC_API_KEY가 있어야 쓰입니다.
      </Empty>
    )
  }

  const key = `mustread:${doc.generatedAt}`
  const done = readIds.has(key)
  const written = new Date(doc.generatedAt).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <>
      <p className="mr-meta">
        약 {readingMinutes(doc.markdown)}분 · {written} 작성 · 숫자는 원문 링크로 확인하세요
      </p>
      <article className={`prose${done ? ' read' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
      {done ? (
        <p className="mr-done">다 읽었습니다.</p>
      ) : (
        <button
          type="button"
          className="finish"
          onClick={() => {
            markRead(key)
            onFinished()
          }}
        >
          다 읽었습니다
        </button>
      )}
    </>
  )
}

export function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="segments" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'on' : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
