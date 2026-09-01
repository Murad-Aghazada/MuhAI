import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Invoices from './pages/Invoices.jsx'
import Tax from './pages/Tax.jsx'
import Inventory from './pages/Inventory.jsx'
import Payroll from './pages/Payroll.jsx'
import Assistant from './pages/Assistant.jsx'

import './styles/components.css'
import './styles/layout.css'
import './styles/chat.css'
import './styles/landing.css'
import './styles/pages.css'

export default function App() {
  return (
    <>
      <div className="grain" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="tax" element={<Tax />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="assistant" element={<Assistant />} />
        </Route>
      </Routes>
    </>
  )
}
