import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { portfolioNextStep } from '../../../../shared/portfolio-next-step'

export function PortfolioNextStep({
  state,
  feature,
  item,
  busy,
  onTab,
  onEdit,
  onCreateTask,
  onCreateRole
}: {
  state: PortfolioState
  feature: PortfolioFeature
  item: PortfolioWorkItem
  busy: boolean
  onTab: (tab: string) => void
  onEdit: () => void
  onCreateTask: (id: string) => void
  onCreateRole: () => void
}): React.JSX.Element {
  const step = portfolioNextStep(state, feature, item)
  const guidance = {
    requirements: {
      text: translate(
        'portfolio.nextRequirements',
        'Define the shared acceptance criteria and add design context before implementation.'
      ),
      label: translate('portfolio.editWorkItem', 'Edit work item'),
      action: onEdit
    },
    reverify: {
      text: translate(
        'portfolio.nextReverify',
        'This accepted work has no current passing evidence. Reopen it from Review and complete parity verification before publication.'
      ),
      label: translate('portfolio.workReviewTab', 'Review'),
      action: () => onTab('review')
    },
    reopen: {
      text: translate(
        'portfolio.nextReopen',
        'Return this work item to Planned to add the missing acceptance criteria.'
      ),
      label: translate('portfolio.workReviewTab', 'Review'),
      action: () => onTab('review')
    },
    investigate: {
      text: translate(
        'portfolio.nextInvestigate',
        'Assign a discovery task to clarify the problem, expected behavior, and open questions.'
      ),
      label: state.roles.length
        ? translate('portfolio.newTask', 'New task')
        : translate('portfolio.newRole', 'New role'),
      action: () => (state.roles.length ? onCreateTask(item.id) : onCreateRole())
    },
    tasks: {
      text: translate(
        'portfolio.nextTasks',
        'Review linked tasks and resolve blockers. Accept the results and close executions before final verification.'
      ),
      label: translate('portfolio.openTasks', 'Open tasks'),
      action: () => onTab('tasks')
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
        'The prerequisites are complete. Review the work item and record the acceptance decision.'
      ),
      label: translate('portfolio.workReviewTab', 'Review'),
      action: () => onTab('review')
    },
    publish: {
      text: translate(
        'portfolio.nextPublish',
        'Work accepted. Review and explicitly publish the new shared specification.'
      ),
      label: translate('portfolio.workReviewTab', 'Review'),
      action: () => onTab('review')
    },
    followUp: {
      text: translate(
        'portfolio.nextFollowUp',
        'The baseline changed. Create a new work item against the current specification to reconcile this proposal.'
      ),
      label: '',
      action: () => {}
    },
    published: {
      text: translate(
        'portfolio.nextPublished',
        'Specification published. Track subsequent bugs and improvements as new work items.'
      ),
      label: '',
      action: () => {}
    },
    complete: {
      text: translate(
        'portfolio.nextComplete',
        'Work accepted. Findings and evidence remain available in this work item.'
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
