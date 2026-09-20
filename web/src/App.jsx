import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Invoices from './pages/Invoices.jsx'
import Tax from './pages/Tax.jsx'
import Bank from './pages/Bank.jsx'
import Inventory from './pages/Inventory.jsx'
import Payroll from './pages/Payroll.jsx'
import Assistant from './pages/Assistant.jsx'
import Settings from './pages/Settings.jsx'

import './styles/components.css'
import './styles/layout.css'
import './styles/chat.css'
import './styles/landing.css'
import './styles/pages.css'
import './styles/auth.css'

export default function App() {
  return (
    <>
      <div className="grain" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="tax" element={<Tax />} />
            <Route path="bank" element={<Bank />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
