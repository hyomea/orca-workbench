import { CircleCheck, CircleDashed } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { PortfolioTaskStep } from '../../../../shared/portfolio-task-stages'

// The development checklist the agent works through, one commit per step.
export function PortfolioTaskSteps({
  steps
}: {
  steps: readonly PortfolioTaskStep[]
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="font-medium">
        {translate('portfolio.stepsTitle', 'Steps ({{done}} of {{total}} done)', {
          done: steps.filter((step) => step.done).length,
          total: steps.length
        })}
      </h3>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.noSteps',
            'No steps yet. The agent proposes them before it starts, and marks each one done when it is committed.'
          )}
        </p>
      ) : (
        <ol className="space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2">
              {step.done ? (
                <CircleCheck
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-label={translate('portfolio.stepDone', 'Done')}
                />
              ) : (
                <CircleDashed
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-label={translate('portfolio.stepOpen', 'Not done')}
                />
              )}
              <span className="min-w-0 break-words">
                {step.title}
                {step.commit && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {step.commit.slice(0, 10)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
