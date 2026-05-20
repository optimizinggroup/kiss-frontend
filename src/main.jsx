import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom'
import KissStep1Lead from './components/KissStep1Lead'
import KissStep2Upload from './components/KissStep2Upload'
import './index.css'

function Step1Wrapper() {
  const { slug } = useParams()
  return <KissStep1Lead slug={slug} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<KissStep1Lead />} />
        <Route path="/start" element={<KissStep1Lead />} />
        <Route path="/:slug" element={<Step1Wrapper />} />
        <Route path="/:slug/upload/:submissionId" element={<KissStep2Upload />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
