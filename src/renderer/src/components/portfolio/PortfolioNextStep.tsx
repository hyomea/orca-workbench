import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { portfolioNextStep } from '../../../../shared/portfolio-next-step'
import { portfolioDiscussPrompt } from './portfolio-discovery-prompt'

export function PortfolioNextStep({
  state,
  feature,
  item,
  busy,
  onTab,
  onOpenTasks,
  onEdit,
  onDiscuss
}: {
  state: PortfolioState
  feature: PortfolioFeature | undefined
  item: PortfolioWorkItem
  busy: boolean
  onTab: (tab: string) => void
  onOpenTasks: () => void
  onEdit: () => void
  onDiscuss: (prompt: string) => void
}): React.JSX.Element {
  const step = portfolioNextStep(state, feature, item)
  const steward = state.stewardName ?? translate('portfolio.stewardFallback', 'the coordinator')
  const guidance = {
    requirements: {
      text: translate(
        'portfolio.nextRequirements',
        'Define the shared acceptance criteria and add design context before implementation.'
      ),
      label: translate('portfolio.editWorkItem', 'Edit outcome'),
      action: onEdit
    },
    reverify: {
      text: translate(
        'portfolio.nextReverify',
        'This accepted work has no current passing evidence. Reopen it from Sign-off and complete parity verification before publication.'
      ),
      label: translate('portfolio.workReviewTab', 'Sign-off'),
      action: () => onTab('review')
    },
    reopen: {
      text: translate(
        'portfolio.nextReopen',
        'Acceptance criteria are missing. Add them once no task is running and the outcome has no test plan.'
      ),
      label: '',
      action: () => {}
    },
    discuss: {
      text: translate(
        'portfolio.nextDiscuss',
        'Work this out with {{name}}: the problem, the evidence, and the options. It ends as work on this outcome, a Jira ticket, or a note for later.',
        { name: steward }
      ),
      label: translate('portfolio.discussWith', 'Discuss with {{name}}', { name: steward }),
      action: () => onDiscuss(portfolioDiscussPrompt(state, item))
    },
    tasks: {
      text: translate(
        'portfolio.nextTasks',
        'Work is in progress. Start, review, and accept each stage on the Tasks page.'
      ),
      label: translate('portfolio.openInTasks', 'Open in Tasks'),
      action: onOpenTasks
    },
    plan: {
      text: translate(
        'portfolio.nextPlan',
        'Turn the acceptance criteria into shared scenarios with expected results for iOS and Android.'
      ),
      label: translate('portfolio.openTests', 'Open parity & tests'),
      action: () => onTab('tests')
    },
    confirm: {
      text: translate(
        'portfolio.nextConfirm',
        'Review and confirm the test plan before recording platform results.'
      ),
      label: translate('portfolio.openTests', 'Open parity & tests'),
      action: () => onTab('tests')
    },
    verify: {
      text: translate(
        'portfolio.nextVerify',
        'Record and review evidence for both platforms. Create fix tasks for failures, then retest. Add implementation tasks in Tasks if work remains.'
      ),
      label: translate('portfolio.openTests', 'Open parity & tests'),
      action: () => onTab('tests')
    },
    review: {
      text: translate(
        'portfolio.nextReview',
        'The prerequisites are complete. Sign off the outcome and record the decision.'
      ),
      label: translate('portfolio.workReviewTab', 'Sign-off'),
      action: () => onTab('review')
    },
    publish: {
      text: translate(
        'portfolio.nextPublish',
        'Work signed off. Explicitly publish the new shared specification.'
      ),
      label: translate('portfolio.workReviewTab', 'Sign-off'),
      action: () => onTab('review')
    },
    followUp: {
      text: translate(
        'portfolio.nextFollowUp',
        'The baseline changed. Create a new outcome against the current specification to reconcile this proposal.'
      ),
      label: '',
      action: () => {}
    },
    published: {
      text: translate(
        'portfolio.nextPublished',
        'Specification published. Track subsequent bugs and improvements as new outcomes.'
      ),
      label: '',
      action: () => {}
    },
    complete: {
      text: translate(
        'portfolio.nextComplete',
        'Signed off. Findings and evidence remain available in this outcome.'
      ),
      label: '',
      action: () => {}
    }
  }[step]
  return (
    <section className="flex flex-col items-start justify-between gap-3 rounded-md bg-muted p-3 text-muted-foreground @md/project:flex-row @md/project:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="text-xs font-semibold text-foreground">
          {translate('portfolio.nextStep', 'Next step')}
        </h4>
        <p className="text-sm">{guidance.text}</p>
      </div>
      {guidance.label && (
        <Button size="sm" variant="outline" disabled={busy} onClick={guidance.action}>
          {guidance.label}
        </Button>
      )}
    </section>
  )
}
