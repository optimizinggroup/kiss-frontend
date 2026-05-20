// Routes are wired in main.jsx — this file is kept only so any
// existing imports of `./App` don't break. The actual route components
// are KissStep1Lead and KissStep2Upload.
import KissStep1Lead from './components/KissStep1Lead'

export default function App() {
  return <KissStep1Lead />
}
