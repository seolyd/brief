import { useCallback, useEffect, useState } from 'react'

/**
 * 모든 상태는 이 기기의 localStorage에만 있습니다. 계정도 서버도 없습니다.
 * 사생활 보호 창처럼 저장이 막힌 곳에서도 앱이 멈추지 않게 전부 감쌉니다.
 */
const EVENT = 'brief-store'

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 유지됩니다.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
}

/** 같은 키를 쓰는 화면들이 서로의 변경을 바로 봅니다. */
export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read(key, fallback))
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
    // fallback은 매 렌더 새 객체라 의존성에서 뺍니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(read(key, fallback)) : next
      write(key, resolved)
      setValue(resolved)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, set]
}

/** 읽음 표시. 오래된 id는 피드에서 사라지므로 300개만 들고 있습니다. */
export function useReadIds(): [Set<string>, (id: string) => void] {
  const [ids, setIds] = useStored<string[]>('read', [])
  const mark = useCallback(
    (id: string) => setIds((prev) => (prev.includes(id) ? prev : [id, ...prev].slice(0, 300))),
    [setIds],
  )
  return [new Set(ids), mark]
}

export interface LaterItem {
  id: string
  url: string
  title: string
  savedAt: number
}

export function useLater(): [LaterItem[], (item: Omit<LaterItem, 'id' | 'savedAt'>) => void, (id: string) => void] {
  const [items, setItems] = useStored<LaterItem[]>('later', [])
  const add = useCallback(
    (item: Omit<LaterItem, 'id' | 'savedAt'>) =>
      setItems((prev) =>
        prev.some((p) => p.url === item.url)
          ? prev
          : [{ ...item, id: crypto.randomUUID(), savedAt: Date.now() }, ...prev],
      ),
    [setItems],
  )
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), [setItems])
  return [items, add, remove]
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
