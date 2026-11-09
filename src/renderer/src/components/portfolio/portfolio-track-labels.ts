import { translate } from '@/i18n/i18n'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import type { PortfolioTaskAttention } from './portfolio-task-lanes'
import type { PortfolioOutcomePhase } from './portfolio-outcome-phase'

export function stageName(stage: PortfolioTaskStage): string {
  switch (stage) {
    case 'development':
      return translate('portfolio.stageDevelopment', 'Development')
    case 'codeReview':
      return translate('portfolio.stageCodeReview', 'Code review')
    case 'qa':
      return translate('portfolio.stageQa', 'QA')
  }
}

export function outcomePhaseName(phase: PortfolioOutcomePhase): string {
  switch (phase) {
    case 'published':
      return translate('portfolio.phasePublished', 'Published')
    case 'signedOff':
      return translate('portfolio.phaseSignedOff', 'Signed off')
    case 'discovery':
      return translate('portfolio.phaseDiscovery', 'Discovery')
    case 'planning':
      return translate('portfolio.phasePlanning', 'Planning')
    case 'merge':
      return translate('portfolio.phaseMerge', 'Waiting to merge')
    case 'verification':
      return translate('portfolio.phaseVerification', 'Parity tests')
    case 'signOff':
      return translate('portfolio.phaseSignOff', 'Ready for sign-off')
    default:
      return stageName(phase)
  }
}

export function attentionLabel(attention: PortfolioTaskAttention): string {
  switch (attention) {
    case 'blocked':
      return translate('portfolio.attentionBlocked', 'Marked blocked')
    case 'launch-uncertain':
      return translate('portfolio.attentionLaunch', 'Launch outcome unknown')
    case 'agent-needs-input':
      return translate('portfolio.attentionInput', 'Agent is waiting for input')
    case 'agent-stopped':
      return translate('portfolio.attentionStopped', 'Agent stopped without submitting')
    case 'agent-unseen':
      return translate('portfolio.attentionUnseen', 'No agent activity observed')
  }
}

// What the user does next with a task, by its lane.
export function taskNextStep(lane: string, attention?: PortfolioTaskAttention): string {
  if (lane === 'decide') {
    return translate(
      'portfolio.nextDecide',
      'The agent submitted its result. Read the evidence, look at the code if you want to, then accept or send it back.'
    )
  }
  if (lane === 'ready') {
    return translate('portfolio.nextReady', 'Choose a workspace and start the agent.')
  }
  if (lane === 'running') {
    return translate(
      'portfolio.nextRunning',
      'The agent is working. When it is done, ask it in its workspace to submit the task.'
    )
  }
  if (lane === 'accepted') {
    return translate('portfolio.nextAccepted', 'Accepted. Nothing left to do.')
  }
  switch (attention) {
    case 'blocked':
      return translate(
        'portfolio.nextBlocked',
        'This task is marked blocked. Resolve the blocker, then return it to planned.'
      )
    case 'launch-uncertain':
      return translate(
        'portfolio.unknownLaunch',
        'Launch outcome is unresolved. Retry checks the original request; it does not request a new execution.'
      )
    case 'agent-needs-input':
      return translate(
        'portfolio.nextInput',
        'The agent is waiting for your answer in its workspace.'
      )
    default:
      return translate(
        'portfolio.nextStopped',
        'The agent stopped without submitting a result. If the work is done, ask it in its workspace to submit the task; if the work cannot be used, end this execution.'
      )
  }
}
