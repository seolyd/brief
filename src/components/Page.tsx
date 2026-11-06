import type { ReactNode } from 'react'

export function Page({ kicker, title, children }: { kicker?: string; title: string; children: ReactNode }) {
  return (
    <main className="page">
      <header className="head">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
