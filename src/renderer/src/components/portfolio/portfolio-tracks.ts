import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import type {
  PortfolioWorkItem,
  PortfolioWorkPlatform
} from '../../../../shared/portfolio-features'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import {
  portfolioTaskLane,
  portfolioTaskObservation,
  type PortfolioTaskAttention,
  type PortfolioTaskLane
} from './portfolio-task-lanes'

export const PORTFOLIO_STAGES = ['development', 'codeReview', 'qa'] as const

export type PortfolioTrackCell = {
  task: PortfolioTask
  lane: PortfolioTaskLane
  attention?: PortfolioTaskAttention
  observation?: AgentStatusEntry
}

// Who moves the track forward: the user (decide, unblock, start, or plan), an agent, or nobody
// here (another team's ticket, or finished work).
export type PortfolioTrackNext = 'decide' | 'attention' | 'start' | 'plan' | 'agent' | 'none'

export type PortfolioTrack = {
  key: string
  projectId: string
  title: string
  item?: PortfolioWorkItem
  platform?: PortfolioWorkPlatform
  ticket?: string
  cells: Partial<Record<PortfolioTaskStage, PortfolioTrackCell>>
  // The first stage still open; 'done' once development is accepted.
  current: PortfolioTaskStage | 'done' | 'external'
  next: PortfolioTrackNext
}

const ORDER: Record<PortfolioTrackNext, number> = {
  attention: 0,
  decide: 1,
  start: 2,
  plan: 3,
  agent: 4,
  none: 5
}

function nextFor(cell: PortfolioTrackCell | undefined): PortfolioTrackNext {
  if (!cell) {
    return 'plan'
  }
  switch (cell.lane) {
    case 'decide':
      return 'decide'
    case 'attention':
      return 'attention'
    case 'ready':
      return 'start'
    case 'running':
      return 'agent'
    case 'accepted':
      return 'none'
  }
}

function track(
  base: Omit<PortfolioTrack, 'cells' | 'current' | 'next'>,
  tasks: readonly PortfolioTask[],
  activity: Record<string, AgentStatusEntry>,
  now: number
): PortfolioTrack {
  const cells: PortfolioTrack['cells'] = {}
  for (const task of tasks) {
    const observation = portfolioTaskObservation(task, activity)
    cells[task.stage] = { task, observation, ...portfolioTaskLane(task, observation, now) }
  }
  const development = cells.development
  if (!development) {
    const external = base.platform === 'backend' && Boolean(base.ticket)
    return {
      ...base,
      cells,
      current: external ? 'external' : 'development',
      next: external ? 'none' : 'plan'
    }
  }
  const submitted = development.task.status === 'review' || development.task.status === 'accepted'
  if (!submitted) {
    return { ...base, cells, current: 'development', next: nextFor(development) }
  }
  for (const stage of ['codeReview', 'qa'] as const) {
    const cell = cells[stage]
    if (cell && cell.task.status !== 'accepted') {
      return { ...base, cells, current: stage, next: nextFor(cell) }
    }
  }
  return development.task.status === 'accepted'
    ? { ...base, cells, current: 'done', next: 'none' }
    : { ...base, cells, current: 'development', next: 'decide' }
}

// One row per outcome and platform: its tickets and its tasks' platforms, in that order.
// Tasks outside any outcome are rows of their own.
export function portfolioTracks(
  state: PortfolioState,
  projectId: string | undefined,
  activity: Record<string, AgentStatusEntry>,
  now: number
): PortfolioTrack[] {
  const inScope = <T extends { projectId: string }>(entry: T) =>
    !projectId || entry.projectId === projectId
  const tracks: PortfolioTrack[] = []
  for (const item of state.workItems.filter(inScope)) {
    const tasks = state.tasks.filter((task) => task.workItemId === item.id)
    const platforms = [
      ...new Set<PortfolioWorkPlatform | undefined>([
        ...item.tickets.map((ticket) => ticket.platform),
        ...tasks.map((task) => task.platform)
      ])
    ]
    // An outcome without tickets or tasks still shows, so the user sees it needs planning.
    for (const platform of platforms.length ? platforms : [undefined]) {
      tracks.push(
        track(
          {
            key: `${item.id}:${platform ?? ''}`,
            projectId: item.projectId,
            title: item.title,
            item,
            platform,
            ticket: item.tickets.find((ticket) => ticket.platform === platform)?.reference
          },
          tasks.filter((task) => task.platform === platform),
          activity,
          now
        )
      )
    }
  }
  for (const task of state.tasks.filter((entry) => inScope(entry) && !entry.workItemId)) {
    tracks.push(
      track(
        { key: task.id, projectId: task.projectId, title: task.title, platform: task.platform },
        [task],
        activity,
        now
      )
    )
  }
  return tracks.sort((a, b) => ORDER[a.next] - ORDER[b.next])
}
