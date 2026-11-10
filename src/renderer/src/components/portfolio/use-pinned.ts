import { useCallback, useState } from 'react'
import { z } from 'zod'
import { useActiveWorkbenchId } from './workbench-selection'

const Pins = z.array(z.string())

export type PortfolioPinKind = 'tracks' | 'outcomes'

function storageKey(kind: PortfolioPinKind, workbenchId: string): string {
  return `orca.workbench.pinned${kind === 'tracks' ? 'Tracks' : 'Outcomes'}.${workbenchId}`
}

function read(kind: PortfolioPinKind, workbenchId: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(storageKey(kind, workbenchId))
    return new Set(Pins.parse(JSON.parse(stored ?? '[]')))
  } catch {
    return new Set()
  }
}

// What the user keeps at the top: tickets on the Tasks page, outcomes in Workbench, per
// workbench. A view preference for this window only, so it lives in local storage rather than
// in Workbench's data.
export function usePinned(kind: PortfolioPinKind): {
  pinned: ReadonlySet<string>
  toggle: (key: string) => void
} {
  const workbenchId = useActiveWorkbenchId()
  const [state, setState] = useState(() => ({ workbenchId, pinned: read(kind, workbenchId) }))
  if (state.workbenchId !== workbenchId) {
    setState({ workbenchId, pinned: read(kind, workbenchId) })
  }
  const toggle = useCallback(
    (key: string) => {
      setState((previous) => {
        const pinned = new Set(previous.pinned)
        if (!pinned.delete(key)) {
          pinned.add(key)
        }
        try {
          window.localStorage.setItem(
            storageKey(kind, previous.workbenchId),
            JSON.stringify([...pinned])
          )
        } catch {
          // The pins still apply until the page reloads.
        }
        return { workbenchId: previous.workbenchId, pinned }
      })
    },
    [kind]
  )
  return {
    pinned: state.workbenchId === workbenchId ? state.pinned : read(kind, workbenchId),
    toggle
  }
}
