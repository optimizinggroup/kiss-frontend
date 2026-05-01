import { useParams } from 'react-router-dom'
import KissIntakeForm from './components/KissIntakeForm'

export default function App() {
  const { slug } = useParams()

  return (
    <div>
      <KissIntakeForm slug={slug} />
    </div>
  )
}
