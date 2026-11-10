import { useCallback, useState } from 'react'
import { useActiveWorkbenchId } from './workbench-selection'

function storageKey(workbenchId: string): string {
  return `orca.workbench.initiative.${workbenchId}`
}

function read(workbenchId: string): string {
  try {
    return window.localStorage.getItem(storageKey(workbenchId)) ?? ''
  } catch {
    return ''
  }
}

// The initiative the Workbench page shows, remembered per workbench for this window; an empty
// or removed one falls back to the first initiative.
export function useRememberedInitiative(): [string, (id: string) => void] {
  const workbenchId = useActiveWorkbenchId()
  const [state, setState] = useState(() => ({ workbenchId, id: read(workbenchId) }))
  if (state.workbenchId !== workbenchId) {
    setState({ workbenchId, id: read(workbenchId) })
  }
  const select = useCallback(
    (id: string) => {
      setState({ workbenchId, id })
      try {
        window.localStorage.setItem(storageKey(workbenchId), id)
      } catch {
        // The choice holds until the page reloads.
      }
    },
    [workbenchId]
  )
  return [state.workbenchId === workbenchId ? state.id : read(workbenchId), select]
}
