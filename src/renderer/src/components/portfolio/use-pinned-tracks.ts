import { useCallback, useState } from 'react'
import { z } from 'zod'
import { useActiveWorkbenchId } from './workbench-selection'

const Pins = z.array(z.string())

function storageKey(workbenchId: string): string {
  return `orca.workbench.pinnedTracks.${workbenchId}`
}

function read(workbenchId: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(storageKey(workbenchId))
    return new Set(Pins.parse(JSON.parse(stored ?? '[]')))
  } catch {
    return new Set()
  }
}

// The tickets the user keeps at the top of the Tasks page, per workbench. A view preference for
// this window only, so it lives in local storage rather than in Workbench's data.
export function usePinnedTracks(): {
  pinned: ReadonlySet<string>
  toggle: (trackKey: string) => void
} {
  const workbenchId = useActiveWorkbenchId()
  const [state, setState] = useState(() => ({ workbenchId, pinned: read(workbenchId) }))
  if (state.workbenchId !== workbenchId) {
    setState({ workbenchId, pinned: read(workbenchId) })
  }
  const toggle = useCallback((trackKey: string) => {
    setState((previous) => {
      const pinned = new Set(previous.pinned)
      if (!pinned.delete(trackKey)) {
        pinned.add(trackKey)
      }
      try {
        window.localStorage.setItem(storageKey(previous.workbenchId), JSON.stringify([...pinned]))
      } catch {
        // The pins still apply until the page reloads.
      }
      return { workbenchId: previous.workbenchId, pinned }
    })
  }, [])
  return { pinned: state.workbenchId === workbenchId ? state.pinned : read(workbenchId), toggle }
}
