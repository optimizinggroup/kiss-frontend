import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/start" element={<App />} />
        <Route path="/:slug" element={<App />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
// Webhook test: Fri May  1 18:39:32 UTC 2026
