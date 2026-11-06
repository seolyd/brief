import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: '아침', d: 'M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M7 17a5 5 0 0 1 10 0M3 20h18' },
  { to: '/evening', label: '저녁', d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' },
  { to: '/listen', label: '듣기', d: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z' },
  { to: '/later', label: '나중에', d: 'M6 3h12v18l-6-4-6 4z' },
  { to: '/habits', label: '습관', d: 'M4 12l5 5L20 6' },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 화면">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={t.d} />
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
