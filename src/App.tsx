import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { loadBrief, loadFeed } from './lib/data'
import { DataContext, type DataState } from './lib/useData'
import { TabBar } from './components/TabBar'
import { Morning } from './pages/Morning'
import { Evening } from './pages/Evening'
import { Listen } from './pages/Listen'
import { Later } from './pages/Later'
import { Habits } from './pages/Habits'

export function App() {
  const [data, setData] = useState<DataState>({ loading: true, feed: null, brief: null })

  useEffect(() => {
    void Promise.all([loadFeed(), loadBrief()]).then(([feed, brief]) => setData({ loading: false, feed, brief }))
  }, [])

  return (
    <DataContext.Provider value={data}>
      <div className="shell">
        <Routes>
          <Route path="/" element={<Morning />} />
          <Route path="/evening" element={<Evening />} />
          <Route path="/listen" element={<Listen />} />
          <Route path="/later" element={<Later />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </div>
    </DataContext.Provider>
  )
}
