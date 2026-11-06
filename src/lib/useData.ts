import { createContext, useContext } from 'react'
import type { BriefFile, FeedFile } from './data'

export interface DataState {
  loading: boolean
  feed: FeedFile | null
  brief: BriefFile | null
}

export const DataContext = createContext<DataState>({ loading: true, feed: null, brief: null })
export const useData = () => useContext(DataContext)
