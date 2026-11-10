import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { PortfolioState, PortfolioTask } from '../../../../shared/portfolio'
import type {
  PortfolioTicketRole,
  PortfolioWorkItem,
  PortfolioWorkPlatform
} from '../../../../shared/portfolio-features'
import {
  portfolioSubmittedCommit,
  type PortfolioTaskStage
} from '../../../../shared/portfolio-task-stages'
import {
  portfolioTaskLane,
  portfolioTaskObservation,
  type PortfolioTaskAttention,
  type PortfolioTaskLane
} from './portfolio-task-lanes'
import type { PortfolioPrLookup, PortfolioPrStatus, PortfolioTrackPr } from './portfolio-track-pr'

export const PORTFOLIO_STAGES = ['development', 'codeReview', 'qa'] as const

export type PortfolioTrackCell = {
  task: PortfolioTask
  lane: PortfolioTaskLane
  attention?: PortfolioTaskAttention
  observation?: AgentStatusEntry
}

// Who moves the track forward: the user (decide, unblock, start, or plan), an agent, PR
// reviewers and CI (waiting), or nobody here (another team's ticket, or finished work).
export type PortfolioTrackNext =
  | 'decide'
  | 'attention'
  | 'start'
  | 'plan'
  | 'agent'
  | 'waiting'
  | 'none'

export type PortfolioTrack = {
  key: string
  projectId: string
  title: string
  item?: PortfolioWorkItem
  platform?: PortfolioWorkPlatform
  ticket?: string
  // The user's part on this platform; a reviewer's track follows a teammate's PR.
  role: PortfolioTicketRole
  prLink?: string
  cells: Partial<Record<PortfolioTaskStage, PortfolioTrackCell>>
  // The first stage still open; in a team initiative, accepted work then waits to merge.
  current: PortfolioTaskStage | 'merge' | 'done' | 'external'
  next: PortfolioTrackNext
  // A team initiative's PR for the branch development runs on, once development started; for a
  // reviewer, the teammate's PR as checked out for the review.
  pr?: PortfolioTrackPr
  // The teammate pushed after the reviewer's last submitted review.
  newCommits?: boolean
}

const ORDER: Record<PortfolioTrackNext, number> = {
  attention: 0,
  decide: 1,
  start: 2,
  plan: 3,
  agent: 4,
  waiting: 5,
  none: 6
}

const PR_NEXT: Record<PortfolioPrStatus, PortfolioTrackNext> = {
  checking: 'none',
  none: 'start',
  draft: 'decide',
  ciFailing: 'attention',
  closed: 'attention',
  changesRequested: 'decide',
  readyToMerge: 'decide',
  inReview: 'waiting',
  merged: 'none'
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
  now: number,
  prFor: PortfolioPrLookup | undefined
): PortfolioTrack {
  const cells: PortfolioTrack['cells'] = {}
  for (const task of tasks) {
    const observation = portfolioTaskObservation(task, activity)
    cells[task.stage] = { task, observation, ...portfolioTaskLane(task, observation, now) }
  }
  const development = cells.development
  // Before roles, a backend ticket without development was another team's work.
  const external =
    base.role === 'tracking' ||
    (base.role === 'author' && !development && base.platform === 'backend' && Boolean(base.ticket))
  if (external) {
    return { ...base, cells, current: 'external', next: 'none' }
  }
  if (base.role === 'reviewer') {
    return reviewerTrack(base, cells, prFor)
  }
  if (!development) {
    return { ...base, cells, current: 'development', next: 'plan' }
  }
  const worktreeId = development.task.attempts.at(-1)?.worktreeId
  const pr = prFor && worktreeId ? prFor(worktreeId) : undefined
  const at = (current: PortfolioTrack['current'], next: PortfolioTrackNext): PortfolioTrack => ({
    ...base,
    cells,
    current,
    next,
    ...(pr ? { pr } : {})
  })
  const submitted = development.task.status === 'review' || development.task.status === 'accepted'
  if (!submitted) {
    return at('development', nextFor(development))
  }
  for (const stage of ['codeReview', 'qa'] as const) {
    const cell = cells[stage]
    if (cell && cell.task.status !== 'accepted') {
      return at(stage, nextFor(cell))
    }
  }
  if (development.task.status !== 'accepted') {
    return at('development', 'decide')
  }
  // Team work is done once its PR merges; a removed workspace can no longer be followed.
  return !pr || pr.status === 'merged' ? at('done', 'none') : at('merge', PR_NEXT[pr.status])
}

// The user reviews and tests a teammate's PR: code review, then QA, then done when it merges.
function reviewerTrack(
  base: Omit<PortfolioTrack, 'cells' | 'current' | 'next'>,
  cells: PortfolioTrack['cells'],
  prFor: PortfolioPrLookup | undefined
): PortfolioTrack {
  const review = cells.codeReview?.task
  const worktreeId = (review ?? cells.qa?.task)?.attempts.at(-1)?.worktreeId
  const pr = prFor && worktreeId ? prFor(worktreeId) : undefined
  const reviewed = review && portfolioSubmittedCommit(review)
  const newCommits = Boolean(reviewed && pr?.headSha && !pr.headSha.startsWith(reviewed))
  const at = (current: PortfolioTrack['current'], next: PortfolioTrackNext): PortfolioTrack => ({
    ...base,
    cells,
    current,
    next,
    ...(pr ? { pr } : {}),
    ...(newCommits ? { newCommits } : {})
  })
  for (const stage of ['codeReview', 'qa'] as const) {
    const cell = cells[stage]
    if (!cell) {
      return at(stage, 'plan')
    }
    if (cell.task.status !== 'accepted') {
      return at(stage, newCommits && stage === 'codeReview' ? 'decide' : nextFor(cell))
    }
  }
  if (newCommits) {
    return at('codeReview', 'decide')
  }
  return !pr || pr.status === 'merged' ? at('done', 'none') : at('merge', 'waiting')
}

// One row per outcome and platform: its tickets and its tasks' platforms, in that order.
// Tasks outside any outcome are rows of their own.
export function portfolioTracks(
  state: PortfolioState,
  projectId: string | undefined,
  activity: Record<string, AgentStatusEntry>,
  now: number,
  prFor: PortfolioPrLookup = () => undefined
): PortfolioTrack[] {
  const inScope = <T extends { projectId: string }>(entry: T) =>
    !projectId || entry.projectId === projectId
  // Personal initiatives finish at acceptance; only team ones follow a PR.
  const teamPr = (id: string) =>
    state.projects.find((project) => project.id === id)?.reviewMode === 'team' ? prFor : undefined
  const tracks: PortfolioTrack[] = []
  // A discovery is worked out with the steward, not by task agents, until it becomes work.
  for (const item of state.workItems.filter(
    (entry) => inScope(entry) && entry.kind !== 'investigation'
  )) {
    const tasks = state.tasks.filter((task) => task.workItemId === item.id)
    // A row per ticket the outcome has, plus any platform that already has tasks; a platform
    // listed without a ticket reference is not shown until its ticket exists or work starts.
    const platforms = [
      ...new Set<PortfolioWorkPlatform | undefined>([
        ...item.tickets
          .filter((ticket) => ticket.reference.trim() || ticket.pr)
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
            ...trackTicket(item, platform)
          },
          tasks.filter((task) => task.platform === platform),
          activity,
          now,
          teamPr(item.projectId)
        )
      )
    }
  }
  for (const task of state.tasks.filter((entry) => inScope(entry) && !entry.workItemId)) {
    tracks.push(
      track(
        {
          key: task.id,
          projectId: task.projectId,
          title: task.title,
          platform: task.platform,
          role: 'author'
        },
        [task],
        activity,
        now,
        teamPr(task.projectId)
      )
    )
  }
  return tracks.sort((a, b) => ORDER[a.next] - ORDER[b.next])
}

function trackTicket(
  item: PortfolioWorkItem,
  platform: PortfolioWorkPlatform | undefined
): Pick<PortfolioTrack, 'ticket' | 'role' | 'prLink'> {
  const ticket = item.tickets.find((entry) => entry.platform === platform)
  return {
    ticket: ticket?.reference.trim() || undefined,
    role: (platform && ticket?.role) || 'author',
    ...(ticket?.pr ? { prLink: ticket.pr } : {})
  }
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
