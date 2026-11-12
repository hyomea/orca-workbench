import { useCallback, useState } from 'react'
import { useActiveWorkbenchId, useWorkbenchGeneration } from './workbench-selection'

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
  const generation = useWorkbenchGeneration()
  const [state, setState] = useState(() => ({ workbenchId, generation, id: read(workbenchId) }))
  if (state.workbenchId !== workbenchId || state.generation !== generation) {
    setState({ workbenchId, generation, id: read(workbenchId) })
  }
  const select = useCallback(
    (id: string) => {
      setState({ workbenchId, generation, id })
      try {
        window.localStorage.setItem(storageKey(workbenchId), id)
      } catch {
        // The choice holds until the page reloads.
      }
    },
    [workbenchId, generation]
  )
  return [
    state.workbenchId === workbenchId && state.generation === generation
      ? state.id
      : read(workbenchId),
    select
  ]
}
