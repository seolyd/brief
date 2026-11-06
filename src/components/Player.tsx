import { useEffect, useRef } from 'react'
import type { FeedItem } from '../lib/data'
import { read, write } from '../lib/store'

/** 앱 안에서 바로 재생합니다. 들은 위치는 기기에 남아, 다음에 이어 듣습니다. */
export function Player({ item, onEnded }: { item: FeedItem; onEnded: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const key = `pos:${item.id}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = read<number>(key, 0)
    const onMeta = () => {
      if (saved > 5 && saved < el.duration - 10) el.currentTime = saved
    }
    let last = 0
    const onTime = () => {
      if (Math.abs(el.currentTime - last) > 5) {
        last = el.currentTime
        write(key, Math.floor(el.currentTime))
      }
    }
    const onEnd = () => {
      write(key, 0)
      onEnded()
    }
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: item.sourceName,
        artwork: item.imageUrl ? [{ src: item.imageUrl, sizes: '512x512' }] : [],
      })
    }
    return () => {
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
    }
  }, [item, key, onEnded])

  return <audio ref={ref} src={item.audioUrl} controls autoPlay preload="metadata" className="audio" />
}
