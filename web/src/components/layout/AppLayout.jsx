import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SideRail from './SideRail.jsx'
import Topbar from './Topbar.jsx'
import { DataProvider } from '../../context/DataContext.jsx'

// The document is what scrolls, so without this a new tab opened at the
// previous tab's scroll position. Called once the old page has faded out and
// before the new one appears, so the jump is never seen; "instant" because
// index.css makes html scroll smoothly, which would glide up instead.
const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

export default function AppLayout() {
  const location = useLocation()

  // Back and forward too: left to the browser, it restores the old position
  // on the page that is still fading out, a visible jump before ours.
  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

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
          <AnimatePresence mode="wait" onExitComplete={toTop}>
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
