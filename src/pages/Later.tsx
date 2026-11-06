import { useState, type FormEvent } from 'react'
import { useLater } from '../lib/store'
import { Empty, Page } from '../components/Page'

/**
 * 궁금한 영상이 생기면 바로 보지 않고 여기에 둡니다. 주소 하나 붙여넣으면 끝.
 * 열어 본 것은 "봤음"으로 지웁니다 — 이 목록은 쌓이는 곳이 아니라 비우는 곳입니다.
 */
export function Later() {
  const [items, add, remove] = useLater()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const clean = url.trim()
    if (!/^https?:\/\//i.test(clean)) return
    add({ url: clean, title: title.trim() || hostOf(clean) })
    setUrl('')
    setTitle('')
  }

  return (
    <Page kicker="바로 보지 않기" title="Later">
      <form className="later-form" onSubmit={submit}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="영상이나 글 주소 붙여넣기"
          inputMode="url"
          autoComplete="off"
          aria-label="주소"
        />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="메모 (선택)" aria-label="메모" />
        <button type="submit" disabled={!/^https?:\/\//i.test(url.trim())}>
          저장
        </button>
      </form>

      {items.length ? (
        <ul className="later-list">
          {items.map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noreferrer noopener">
                <span className="title">{i.title}</span>
                <span className="meta">
                  {hostOf(i.url)} · {new Date(i.savedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </a>
              <button type="button" className="link small" onClick={() => remove(i.id)}>
                봤음
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>비어 있습니다. 좋은 상태입니다.</Empty>
      )}
      {items.length >= 10 && <p className="note">10개가 넘었습니다. 다 볼 수 없다면, 지워도 되는 것들입니다.</p>}
    </Page>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
