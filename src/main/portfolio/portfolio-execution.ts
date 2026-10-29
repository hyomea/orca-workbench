import { randomUUID } from 'node:crypto'
import type { AgentLaunchResult } from '../../shared/agent-launch-intent'
import {
  portfolioTask,
  preparePortfolioAttempt,
  type PortfolioAttempt,
  type PortfolioState
} from '../../shared/portfolio'
import type { PortfolioStore } from './portfolio-store'

const activeLaunches = new Set<string>()

export function portfolioExecutionInFlight(store: PortfolioStore, taskId: string): boolean {
  return activeLaunches.has(JSON.stringify([store.file, taskId]))
}

export async function launchPortfolioTask(
  store: PortfolioStore,
  request: { revision: number; taskId: string; worktreeId: string; repoId: string },
  launch: (attempt: PortfolioAttempt) => Promise<AgentLaunchResult>
): Promise<PortfolioState> {
  const key = JSON.stringify([store.file, request.taskId])
  if (activeLaunches.has(key)) {
    throw new Error('This task is already starting. Refresh to check its outcome.')
  }
  activeLaunches.add(key)
  try {
    return await executePortfolioTask(store, request, launch)
  } finally {
    activeLaunches.delete(key)
  }
}

async function executePortfolioTask(
  store: PortfolioStore,
  request: { revision: number; taskId: string; worktreeId: string; repoId: string },
  launch: (attempt: PortfolioAttempt) => Promise<AgentLaunchResult>
): Promise<PortfolioState> {
  const prepared = await store.update(request.revision, (state) => {
    preparePortfolioAttempt(
      state,
      request.taskId,
      request.worktreeId,
      request.repoId,
      `${Date.now()}-${randomUUID().replaceAll('-', '')}`,
      Date.now()
    )
  })
  const attempt = portfolioTask(prepared, request.taskId).attempts.at(-1)
  if (!attempt) {
    throw new Error('Execution record missing.')
  }
  let result: AgentLaunchResult
  try {
    result = await launch(attempt)
  } catch (error) {
    return store.update(null, (state) => {
      const pending = portfolioTask(state, request.taskId).attempts.find(
        (entry) => entry.operationId === attempt.operationId
      )
      if (!pending || pending.state === 'launched' || pending.state === 'closed') {
        return
      }
      pending.state = 'unknown'
      pending.warning = error instanceof Error ? error.message : String(error)
    })
  }
  return store.update(null, (state) => {
    const pending = portfolioTask(state, request.taskId).attempts.find(
      (entry) => entry.operationId === attempt.operationId
    )
    if (!pending) {
      throw new Error('Execution record missing.')
    }
    if (pending.state !== 'closed') {
      pending.state = 'launched'
    }
    pending.handle = result.outcome.handle
    if (result.outcome.kind === 'terminal') {
      pending.paneKey = result.outcome.paneKey
    } else {
      pending.sessionId = result.outcome.sessionId
    }
    pending.warning =
      [
        result.warning,
        result.prompt?.outcome === 'not-delivered' || result.prompt?.outcome === 'unconfirmed'
          ? 'Prompt delivery is unconfirmed. Inspect the session before sending again.'
          : undefined
      ]
        .filter(Boolean)
        .join('\n') || undefined
  })
}
