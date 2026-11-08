import { EditionView } from '../components/EditionView'

const today = () => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

export function Morning() {
  return <EditionView edition="morning" kicker={today()} title="Morning Brief" />
}
