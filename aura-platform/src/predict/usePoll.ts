import { useEffect, useRef } from 'react'

/** Call `fn` every `ms` while `active` (e.g. while a match is live). Skips
 *  ticks while the tab is hidden and refreshes as soon as it's visible again. */
export function usePoll(active: boolean, fn: () => void, ms = 30_000) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    if (!active) return
    const visible = () => document.visibilityState === 'visible'
    const id = setInterval(() => { if (visible()) ref.current() }, ms)
    const onVisibility = () => { if (visible()) ref.current() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisibility) }
  }, [active, ms])
}
