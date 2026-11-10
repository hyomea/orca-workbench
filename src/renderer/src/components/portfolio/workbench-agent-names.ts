import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { parsePortfolioState, type PortfolioState } from '../../../../shared/portfolio'
import { stageName } from './portfolio-track-labels'
import { refreshWorkbenchList, workbenchList } from './workbench-selection'

type Names = Record<string, string>

// The agent sessions Workbench started, by the pane or terminal each run went to, so the sidebar
// can name them "Kiki · Development" instead of repeating the ticket its workspace already shows.
const names = createStore<{ byWorkbench: Record<string, Names> }>(() => ({ byWorkbench: {} }))

export function workbenchAgentNames(state: PortfolioState): Names {
  const found: Names = {}
  for (const task of state.tasks) {
    const role = state.roles.find((entry) => entry.id === task.roleId)
    if (!role) {
      continue
    }
    const base = `${role.agentName || role.name} · ${stageName(task.stage)}`
    task.attempts.forEach((attempt, index) => {
      // A task run again keeps its earlier sessions; the run number tells them apart.
      const name =
        task.attempts.length > 1
          ? `${base} · ${translate('portfolio.agentRun', 'run {{number}}', { number: index + 1 })}`
          : base
      if (attempt.paneKey) {
        found[`pane:${attempt.paneKey}`] = name
      }
      if (attempt.handle) {
        found[`handle:${attempt.handle}`] = name
      }
    })
  }
  return found
}

export function noteWorkbenchAgents(workbenchId: string, state: PortfolioState): void {
  names.setState((current) => ({
    byWorkbench: { ...current.byWorkbench, [workbenchId]: workbenchAgentNames(state) }
  }))
}

function lookup(
  byWorkbench: Record<string, Names>,
  paneKey: string | undefined,
  handle: string | undefined
): string | undefined {
  for (const found of Object.values(byWorkbench)) {
    const name = (paneKey && found[`pane:${paneKey}`]) || (handle && found[`handle:${handle}`])
    if (name) {
      return name
    }
  }
  return undefined
}

export function workbenchAgentName(
  paneKey: string | undefined,
  handle: string | undefined
): string | undefined {
  return lookup(names.getState().byWorkbench, paneKey, handle)
}

export function useWorkbenchAgentName(
  paneKey: string | undefined,
  handle: string | undefined
): string | undefined {
  return useStore(names, (s) => lookup(s.byWorkbench, paneKey, handle))
}

async function refreshWorkbenchAgents(): Promise<void> {
  await refreshWorkbenchList()
  for (const entry of workbenchList()) {
    const state = parsePortfolioState(
      await callRuntimeRpc({ kind: 'local' }, 'portfolio.read', { workbenchId: entry.id })
    )
    noteWorkbenchAgents(entry.id, state)
  }
}

// Every workbench, not only the open one: the sidebar lists sessions from all of them.
export function followWorkbenchAgents(): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  async function poll(): Promise<void> {
    if (document.visibilityState !== 'hidden') {
      await refreshWorkbenchAgents().catch(() => {
        // Sessions keep their usual names until the next read succeeds.
      })
    }
    if (!stopped) {
      timer = setTimeout(() => void poll(), 10_000)
    }
  }
  void poll()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
