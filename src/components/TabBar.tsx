import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: '아침', d: 'M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M7 17a5 5 0 0 1 10 0M3 20h18' },
  { to: '/evening', label: '저녁', d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' },
  { to: '/listen', label: '듣기', d: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z' },
  { to: '/qt', label: 'QT', d: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5M12 6.5C14 5 17 4.5 20 5v13c-3-.5-6 0-8 1.5M12 6.5v13' },
  { to: '/wealth', label: '재물', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM14.8 9.2A3 3 0 0 0 12 7.5c-1.6 0-2.8.9-2.8 2.2 0 3 5.6 1.6 5.6 4.6 0 1.3-1.2 2.2-2.8 2.2a3 3 0 0 1-2.8-1.7M12 6v1.5M12 16.5V18' },
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
