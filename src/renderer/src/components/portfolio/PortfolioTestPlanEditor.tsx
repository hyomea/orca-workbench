import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import type { PortfolioVerificationPlan } from '../../../../shared/portfolio-verification'
import { PortfolioField } from './portfolio-controls'
import { usePortfolioVerificationDraft } from './use-portfolio-verification-draft'

const ScenarioDraft = z.object({
  id: z.string(),
  criterion: z.string(),
  steps: z.string(),
  testData: z.string(),
  expected: z.string(),
  platformNotes: z.string()
})
const PlanDraft = z.object({ scenarios: z.array(ScenarioDraft), note: z.string() })
function newScenario() {
  return {
    id: createBrowserUuid(),
    criterion: '',
    steps: '',
    testData: '',
    expected: '',
    platformNotes: ''
  }
}
export function PortfolioTestPlanEditor({
  workItemId,
  plan,
  busy,
  onSave,
  onClose
}: {
  workItemId: string
  plan?: PortfolioVerificationPlan
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}) {
  const { draft, setDraft, discard } = usePortfolioVerificationDraft(
    `${workItemId}:plan:${plan?.version ?? 0}`,
    PlanDraft,
    {
      scenarios: plan?.scenarios ?? [newScenario()],
      note: ''
    }
  )
  const fields = [
    {
      id: 'criterion',
      label: translate('portfolio.scenarioCriterion', 'AC covered by this scenario')
    },
    {
      id: 'testData',
      label: translate('portfolio.scenarioData', 'Preconditions and shared test data')
    },
    { id: 'steps', label: translate('portfolio.scenarioSteps', 'Test steps') },
    {
      id: 'expected',
      label: translate('portfolio.scenarioExpected', 'Expected behavior on both platforms')
    },
    {
      id: 'platformNotes',
      label: translate(
        'portfolio.scenarioDifferences',
        'Intentional platform differences (optional)'
      )
    }
  ] as const
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (
          await onSave({
            kind: 'verification.plan',
            workItemId,
            expectedVersion: plan?.version ?? 0,
            ...draft
          })
        ) {
          discard()
          onClose()
        }
      }}
    >
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.planEditHint',
          'Cover the outcome’s AC with shared scenarios. Saving creates a new plan version; earlier results remain in history and must be rerun.'
        )}
      </p>
      {draft.scenarios.map((scenario, index) => (
        <fieldset
          key={scenario.id}
          className="space-y-3 rounded-md border border-border p-3"
          disabled={busy}
        >
          <legend className="px-1 text-sm font-medium">
            {translate('portfolio.scenarioNumber', 'Scenario {{number}}', { number: index + 1 })}
          </legend>
          {fields.map((field) => (
            <PortfolioField key={field.id} label={field.label}>
              <Textarea
                rows={2}
                maxLength={2000}
                required={field.id !== 'platformNotes'}
                value={scenario[field.id]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    scenarios: draft.scenarios.map((entry) =>
                      entry.id === scenario.id
                        ? { ...entry, [field.id]: event.target.value }
                        : entry
                    )
                  })
                }
              />
            </PortfolioField>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={draft.scenarios.length === 1}
            onClick={() =>
              setDraft({
                ...draft,
                scenarios: draft.scenarios.filter((entry) => entry.id !== scenario.id)
              })
            }
          >
            {translate('portfolio.removeScenario', 'Remove scenario')}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || draft.scenarios.length >= 20}
        onClick={() => setDraft({ ...draft, scenarios: [...draft.scenarios, newScenario()] })}
      >
        {translate('portfolio.addScenario', 'Add scenario')}
      </Button>
      <PortfolioField label={translate('portfolio.planChangeNote', 'Plan change note')}>
        <Textarea
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          required
          maxLength={12000}
          rows={2}
          disabled={busy}
        />
      </PortfolioField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {translate('portfolio.saveTestPlan', 'Save test plan')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          {translate('portfolio.closeKeepDraft', 'Close and keep draft')}
        </Button>
      </div>
    </form>
  )
}
