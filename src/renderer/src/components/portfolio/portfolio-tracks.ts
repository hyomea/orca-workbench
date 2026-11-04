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
    // A row per ticket the outcome has, plus any platform that already has tasks; a platform
    // listed without a ticket reference is not shown until its ticket exists or work starts.
    const platforms = [
      ...new Set<PortfolioWorkPlatform | undefined>([
        ...item.tickets
          .filter((ticket) => ticket.reference.trim())
          .map((ticket) => ticket.platform),
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
            ticket:
              item.tickets.find((ticket) => ticket.platform === platform)?.reference.trim() ||
              undefined
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

export type PortfolioTrackGroup = {
  key: string
  title: string
  projectId: string
  item?: PortfolioWorkItem
  tracks: PortfolioTrack[]
}

// Rows grouped under their outcome, most urgent outcome first; tasks outside an outcome stay
// one group each.
export function portfolioTrackGroups(tracks: readonly PortfolioTrack[]): PortfolioTrackGroup[] {
  const groups = new Map<string, PortfolioTrackGroup>()
  for (const track of tracks) {
    const key = track.item?.id ?? track.key
    const group = groups.get(key)
    if (group) {
      group.tracks.push(track)
    } else {
      groups.set(key, {
        key,
        title: track.title,
        projectId: track.projectId,
        item: track.item,
        tracks: [track]
      })
    }
  }
  return [...groups.values()]
}

// A ticket link reads as its key, such as ENG-5952.
export function portfolioTicketLabel(reference: string): string {
  try {
    const url = new URL(reference)
    return url.pathname.split('/').findLast(Boolean) ?? reference
  } catch {
    return reference
  }
}
