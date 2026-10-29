import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { usePortfolioVerificationDraft } from './use-portfolio-verification-draft'

const Draft = z.object({
  outcome: z.enum(['pass', 'fail', 'blocked']),
  build: z.string(),
  environment: z.string(),
  evidence: z.string(),
  taskSnapshot: z.string()
})
export function PortfolioTestResultForm({
  workItemId,
  planVersion,
  scenarioId,
  platform,
  taskSnapshot,
  busy,
  onSave,
  onClose
}: {
  workItemId: string
  planVersion: number
  scenarioId: string
  platform: 'ios' | 'android'
  taskSnapshot: string
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onClose: () => void
}) {
  const { draft, setDraft, discard } = usePortfolioVerificationDraft<z.infer<typeof Draft>>(
    `${workItemId}:${planVersion}:${scenarioId}:${platform}:result`,
    Draft,
    {
      outcome: 'pass',
      build: '',
      environment: '',
      evidence: '',
      taskSnapshot
    }
  )
  const stale = draft.taskSnapshot !== taskSnapshot
  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (stale) {
          return
        }
        const { taskSnapshot: expectedTaskSnapshot, ...result } = draft
        if (
          await onSave({
            kind: 'verification.record',
            workItemId,
            planVersion,
            expectedTaskSnapshot,
            result: { ...result, scenarioId, platform }
          })
        ) {
          discard()
          onClose()
        }
      }}
    >
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.recordResultHint',
          'Record a test you actually ran. Include a build or commit, device and OS, environment, actual behavior, and evidence links. Saving does not run tests.'
        )}
      </p>
      {stale && (
        <p role="alert" className="text-sm">
          {translate(
            'portfolio.resultDraftStale',
            'Work changed while this draft was open. Discard it and record a new test.'
          )}
        </p>
      )}
      <PortfolioSelect
        label={translate('portfolio.testOutcome', 'Test outcome')}
        value={draft.outcome}
        disabled={busy}
        onChange={(value) => {
          const outcome = Draft.shape.outcome.safeParse(value)
          if (outcome.success) {
            setDraft({ ...draft, outcome: outcome.data })
          }
        }}
        options={[
          { id: 'pass', name: translate('portfolio.testPass', 'Pass') },
          { id: 'fail', name: translate('portfolio.testFail', 'Fail') },
          { id: 'blocked', name: translate('portfolio.testBlocked', 'Blocked') }
        ]}
      />
      <PortfolioField label={translate('portfolio.testBuild', 'Build or commit')}>
        <Input
          required
          maxLength={2000}
          value={draft.build}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, build: event.target.value })}
        />
      </PortfolioField>
      <PortfolioField label={translate('portfolio.testEnvironment', 'Device, OS, and environment')}>
        <Input
          required
          maxLength={2000}
          value={draft.environment}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, environment: event.target.value })}
        />
      </PortfolioField>
      <PortfolioField label={translate('portfolio.testEvidence', 'Actual result and evidence')}>
        <Textarea
          rows={4}
          required
          maxLength={12000}
          value={draft.evidence}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, evidence: event.target.value })}
        />
      </PortfolioField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || stale}>
          {translate('portfolio.saveTestResult', 'Save test result')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          {translate('portfolio.closeKeepDraft', 'Close and keep draft')}
        </Button>
        {stale && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              discard()
              onClose()
            }}
          >
            {translate('portfolio.discardDraft', 'Discard draft')}
          </Button>
        )}
      </div>
    </form>
  )
}
