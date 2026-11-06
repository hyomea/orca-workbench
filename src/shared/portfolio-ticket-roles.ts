import type { PortfolioState, PortfolioTask } from './portfolio'
import type { PortfolioTicket, PortfolioTicketRole, PortfolioWorkItem } from './portfolio-features'

type TrackKey = Pick<PortfolioTask, 'workItemId' | 'platform'>

// The ticket of a track: its outcome's ticket for that platform.
export function portfolioTrackTicket(
  state: PortfolioState,
  track: TrackKey
): PortfolioTicket | undefined {
  if (!track.workItemId || !track.platform) {
    return undefined
  }
  return state.workItems
    .find((item) => item.id === track.workItemId)
    ?.tickets.find((ticket) => ticket.platform === track.platform)
}

export function portfolioTrackRole(state: PortfolioState, track: TrackKey): PortfolioTicketRole {
  return portfolioTrackTicket(state, track)?.role ?? 'author'
}

// A reviewer reviews and tests a teammate's PR, so the track has no development of its own; a
// tracked platform is someone else's work, with no tasks here.
export function assertPortfolioTrackRole(
  role: PortfolioTicketRole,
  stage: PortfolioTask['stage']
): void {
  if (role === 'tracking') {
    throw new Error('You only track this platform; make yourself its author or reviewer first.')
  }
  if (role === 'reviewer' && stage === 'development') {
    throw new Error('A teammate builds this platform; plan only its code review and QA.')
  }
}

// Changing a platform's role must keep the tasks it already has valid.
export function assertPortfolioTicketRoles(
  state: PortfolioState,
  item: Pick<PortfolioWorkItem, 'id'>,
  tickets: readonly PortfolioTicket[]
): void {
  for (const ticket of tickets) {
    if (!ticket.role || ticket.role === 'author') {
      continue
    }
    if (!ticket.platform) {
      throw new Error('Choose the platform you review or track.')
    }
    for (const task of state.tasks) {
      if (task.workItemId === item.id && task.platform === ticket.platform) {
        assertPortfolioTrackRole(ticket.role, task.stage)
      }
    }
  }
}
