import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import ChatWidget from '../chatbot/ChatWidget.jsx'
import { DataProvider } from '../../context/DataContext.jsx'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <DataProvider>
      <div className="app-shell">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="main-col">
          <Topbar onMenu={() => setMenuOpen(true)} />
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>
        </div>
        {/* The drawer is 280px wide; the launcher's label made it 150px wide
            at right:16px, so the two met over the sidebar's Muhai Score. */}
        <ChatWidget compact={menuOpen} />
      </div>
    </DataProvider>
  )
}
