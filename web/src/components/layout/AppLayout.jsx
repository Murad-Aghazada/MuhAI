import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SideRail from './SideRail.jsx'
import Topbar from './Topbar.jsx'
import { DataProvider } from '../../context/DataContext.jsx'

export default function AppLayout() {
  const location = useLocation()

  return (
    <DataProvider>
      <div className="app-shell">
        {/* Navigation is the left rail and nothing else. The bottom dock and
            the floating assistant launcher are both gone: the assistant has
            its own room in the rail, and a launcher that opens a second copy
            of it over the page was a third way to reach one screen. */}
        <SideRail />

        <div className="main-col">
          <Topbar />
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 0.8, 0.3, 1] }}
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </DataProvider>
  )
}
