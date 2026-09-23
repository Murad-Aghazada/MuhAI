/* ============================================================
   The two marks Lucide does not draw for us.

   Everything else in the console is Lucide at stroke 1.5 on the 24
   grid, which is the weight `landing.css` sets for its own icons.
   These two are here because the assistant needed a mark of its
   own: `Sparkles` is the house style of every AI feature shipped
   since 2023 — three stars of different sizes, stroked, which at
   16px collapses into a grey smudge and at any size says "this is
   an AI feature" in the most generic way available.

   `Spark` is one four-pointed star, FILLED rather than stroked.
   Filled is the whole point: at 15px a stroked star is four thin
   outlines with a hole in the middle, and it is the hole you see.
   Solid, it reads as a mark at every size the app uses it.
   ============================================================ */

/**
 * The assistant's mark. Filled, so it holds at 14px.
 *
 * `size` matches Lucide's prop so it can be dropped in wherever a
 * Lucide icon was; `strokeWidth` is accepted and ignored for the same
 * reason — the call sites pass it to every other icon.
 */
export function Spark({ size = 16, className = '', style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 1.6c.95 5.6 4.8 9.45 10.4 10.4-5.6.95-9.45 4.8-10.4 10.4-.95-5.6-4.8-9.45-10.4-10.4C7.2 11.05 11.05 7.2 12 1.6Z" />
    </svg>
  )
}

/**
 * The same star with a companion, for the one place the assistant gets
 * a whole surface to itself rather than a line in a card: the chat
 * launcher. Two sizes read as motion; one reads as a bullet.
 */
export function SparkPair({ size = 18, className = '', style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <path d="M10 2.4c.8 4.7 4 7.9 8.7 8.7-4.7.8-7.9 4-8.7 8.7-.8-4.7-4-7.9-8.7-8.7C6 10.3 9.2 7.1 10 2.4Z" />
      <path d="M18.6 14.6c.3 1.85 1.55 3.1 3.4 3.4-1.85.3-3.1 1.55-3.4 3.4-.3-1.85-1.55-3.1-3.4-3.4 1.85-.3 3.1-1.55 3.4-3.4Z" />
    </svg>
  )
}
