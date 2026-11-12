import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { z } from 'zod'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import {
  DEFAULT_WORKBENCH_ID,
  type PortfolioWorkbenchSummary
} from '../../../../shared/rpc-contract/portfolio-params'

const ACTIVE_KEY = 'orca.workbench.active'

const Summaries = z.array(z.object({ id: z.string(), name: z.string(), stewardPath: z.string() }))

function storedActive(): string {
  try {
    return window.localStorage.getItem(ACTIVE_KEY) || DEFAULT_WORKBENCH_ID
  } catch {
    return DEFAULT_WORKBENCH_ID
  }
}

// Which workbench the Workbench and Tasks pages show, and the list the sidebar offers.
const selection = createStore<{
  activeId: string
  list: PortfolioWorkbenchSummary[]
  generation: number
}>(() => ({
  activeId: storedActive(),
  list: [],
  generation: 0
}))

export function useActiveWorkbenchId(): string {
  return useStore(selection, (s) => s.activeId)
}

export function useWorkbenchGeneration(): number {
  return useStore(selection, (s) => s.generation)
}

export function useWorkbenchList(): PortfolioWorkbenchSummary[] {
  return useStore(selection, (s) => s.list)
}

export function workbenchList(): PortfolioWorkbenchSummary[] {
  return selection.getState().list
}

// Every Workbench call names the workbench it reads or changes.
export function activeWorkbenchParams(): { workbenchId: string } {
  return { workbenchId: selection.getState().activeId }
}

export function selectWorkbench(id: string): void {
  selection.setState({ activeId: id })
  try {
    window.localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    // Remembering the choice is a convenience; the page works without it.
  }
}

export async function refreshWorkbenchList(): Promise<void> {
  const list = Summaries.parse(await callRuntimeRpc({ kind: 'local' }, 'portfolio.workbenches', {}))
  selection.setState({ list })
  // A workbench removed on disk falls back to the first one.
  if (!list.some((entry) => entry.id === selection.getState().activeId)) {
    selectWorkbench(DEFAULT_WORKBENCH_ID)
  }
}

export async function createWorkbench(name: string): Promise<void> {
  const created = Summaries.element.parse(
    await callRuntimeRpc({ kind: 'local' }, 'portfolio.createWorkbench', { name })
  )
  await refreshWorkbenchList()
  selectWorkbench(created.id)
}

export async function removeWorkbench(id: string): Promise<void> {
  await callRuntimeRpc({ kind: 'local' }, 'portfolio.removeWorkbench', { workbenchId: id })
  try {
    for (const key of [
      `orca.workbench.initiative.${id}`,
      `orca.workbench.pinnedTracks.${id}`,
      `orca.workbench.pinnedOutcomes.${id}`
    ]) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // The saved Workbench is gone even when this window cannot clear view preferences.
  }
  await refreshWorkbenchList()
  selection.setState((current) => ({ generation: current.generation + 1 }))
}

// The page renames a workbench through its data; keep the sidebar's name in step.
export function noteWorkbenchName(id: string, name: string): void {
  const { list } = selection.getState()
  if (list.some((entry) => entry.id === id && entry.name !== name)) {
    selection.setState({
      list: list.map((entry) => (entry.id === id ? { ...entry, name } : entry))
    })
  }
}
