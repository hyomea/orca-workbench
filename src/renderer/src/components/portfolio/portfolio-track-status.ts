import { translate } from '@/i18n/i18n'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import { attentionLabel } from './portfolio-track-labels'
import { PORTFOLIO_STAGES, type PortfolioTrack, type PortfolioTrackCell } from './portfolio-tracks'

export type PortfolioTrackCellStatus = {
  text: string
  tone: 'muted' | 'done' | 'you' | 'alert' | 'agent'
}

// What one stage of a track shows: planned, finished, or, for the stage in progress, who acts.
export function portfolioTrackCellStatus(
  track: PortfolioTrack,
  stage: PortfolioTaskStage,
  cell: PortfolioTrackCell
): PortfolioTrackCellStatus {
  const position = PORTFOLIO_STAGES.indexOf(stage)
  const current =
    track.current === 'done' || track.current === 'external' || track.current === 'merge'
      ? PORTFOLIO_STAGES.length
      : PORTFOLIO_STAGES.indexOf(track.current)
  // A later stage is only planned: its agent has not been started, so say what starts it.
  if (position > current) {
    return {
      text:
        stage === 'qa'
          ? translate('portfolio.trackAfterReview', 'Starts when code review is accepted')
          : translate('portfolio.trackAfterDevelopment', 'Starts when development submits'),
      tone: 'muted'
    }
  }
  if (position < current) {
    return cell.task.status === 'accepted'
      ? { text: translate('portfolio.trackAccepted', 'Accepted'), tone: 'done' }
      : { text: translate('portfolio.trackSubmitted', 'Submitted'), tone: 'done' }
  }
  if (track.next === 'decide') {
    return { text: translate('portfolio.trackDecide', 'Needs your decision'), tone: 'you' }
  }
  if (cell.attention) {
    return { text: attentionLabel(cell.attention), tone: 'alert' }
  }
  if (track.next === 'start') {
    return { text: translate('portfolio.trackStart', 'Ready to start'), tone: 'you' }
  }
  return { text: translate('portfolio.trackWorking', 'Agent working'), tone: 'agent' }
}

// The stage a track is at, for a one-line row: waiting to merge stays with code review, where
// the team's review happens.
export function portfolioTrackCurrentStage(track: PortfolioTrack): PortfolioTaskStage | undefined {
  if (track.current === 'merge') {
    return 'codeReview'
  }
  return PORTFOLIO_STAGES.find((stage) => stage === track.current)
}
