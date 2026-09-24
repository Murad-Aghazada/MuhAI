/* Motion for the side sheets (invoice, product, employee).

   They used to slide in and then vanish on close. With these, and the
   parent rendering the sheet inside <AnimatePresence>, closing plays the
   entrance backwards and a little faster: leaving should never be slower
   than arriving. The scrim stops taking clicks the moment it starts to
   fade, so the page behind is usable again straight away. */

export const scrimMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: 'none' },
  transition: { duration: 0.16, ease: 'easeOut' },
}

export const sheetMotion = {
  initial: { x: 28, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 36, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
  transition: { duration: 0.24, ease: [0.22, 0.8, 0.3, 1] },
}
