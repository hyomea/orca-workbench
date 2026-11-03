import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'
import {
  verificationProgress,
  verificationTaskSnapshot,
  type PortfolioTestResult
} from '../../../../shared/portfolio-verification'
import { PortfolioField } from './portfolio-controls'
import { PortfolioTestPlanEditor } from './PortfolioTestPlanEditor'
import { PortfolioTestResultForm } from './PortfolioTestResultForm'
import { PortfolioTestResultReview } from './PortfolioTestResultReview'

function resultLabel(result: PortfolioTestResult | undefined, current: boolean): string {
  if (!result) {
    return translate('portfolio.testNotRun', 'Not run')
  }
  if (!current) {
    return translate('portfolio.testOutdated', 'Outdated — rerun')
  }
  if (result.review?.decision === 'rejected') {
    return translate('portfolio.evidenceRejected', 'Evidence rejected')
  }
  if (result.outcome === 'fail') {
    return translate('portfolio.testFail', 'Fail')
  }
  if (result.outcome === 'blocked') {
    return translate('portfolio.testBlocked', 'Blocked')
  }
  return result.review?.decision === 'approved'
    ? translate('portfolio.testReviewedPass', 'Reviewed pass')
    : translate('portfolio.testNeedsReview', 'Pass — needs review')
}
export function PortfolioVerification({
  state,
  item,
  busy,
  onSave,
  onSelectTask
}: {
  state: PortfolioState
  item: PortfolioWorkItem
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onSelectTask: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState('')
  const { verification, plan, cells, passed, total, ready } = verificationProgress(state, item.id)
  const cell = cells.find((entry) => `${entry.scenario.id}:${entry.platform}` === selected)
  const locked = item.status === 'accepted'
  const openExecution = state.tasks.some(
    (task) =>
      task.workItemId === item.id &&
      task.attempts.at(-1) &&
      task.attempts.at(-1)?.state !== 'closed'
  )
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-medium">
          {translate('portfolio.sharedVerification', 'Shared scenarios and parity')}
        </h4>
        {!locked && !editing && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !item.acceptanceCriteria.trim()}
            onClick={() => setEditing(true)}
          >
            {plan
              ? translate('portfolio.reviseTestPlan', 'Revise test plan')
              : translate('portfolio.createTestPlan', 'Create test plan')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.verificationHint',
          'Verify iOS and Android against the same AC, design, and test data. A recorded pass needs evidence review. Tests are run in your existing tools.'
        )}
      </p>
      {!item.acceptanceCriteria.trim() && (
        <p className="text-sm">
          {translate(
            'portfolio.missingPlanAc',
            'Add acceptance criteria to the outcome before creating scenarios.'
          )}
        </p>
      )}
      {editing && (
        <PortfolioTestPlanEditor
          key={plan?.version ?? 0}
          workItemId={item.id}
          plan={plan}
          busy={busy}
          onSave={onSave}
          onClose={() => setEditing(false)}
        />
      )}
      {plan && (
        <>
          <p className="text-sm">
            {translate(
              'portfolio.verificationSummary',
              'Plan v{{version}} · {{passed}} / {{total}} platform checks reviewed and passed',
              { version: plan.version, passed, total }
            )}
          </p>
          {!plan.confirmation && !locked && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {translate(
                  'portfolio.confirmCoverageHint',
                  'Review every AC and design state, including empty, loading, and error states where relevant. Confirm that these scenarios cover this change before testing.'
                )}
              </p>
              <PortfolioField label={translate('portfolio.coverageReview', 'Coverage review note')}>
                <Textarea
                  rows={2}
                  value={note}
                  maxLength={12000}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                />
              </PortfolioField>
              <Button
                size="sm"
                disabled={busy || !note.trim() || editing}
                onClick={async () => {
                  if (
                    await onSave({
                      kind: 'verification.confirm',
                      workItemId: item.id,
                      planVersion: plan.version,
                      note
                    })
                  ) {
                    setNote('')
                  }
                }}
              >
                {translate('portfolio.confirmCoverage', 'Confirm AC and scenario coverage')}
              </Button>
            </div>
          )}
          {plan.confirmation && (
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {translate('portfolio.coverageConfirmed', 'Coverage confirmed')}:{' '}
              {plan.confirmation.note}
            </p>
          )}
          <div className="space-y-3">
            {plan.scenarios.map((scenario) => (
              <div key={scenario.id} className="space-y-3 rounded-md border border-border p-3">
                <p className="whitespace-pre-wrap break-words text-sm font-medium">
                  {scenario.criterion}
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer">
                    {translate('portfolio.scenarioDetails', 'Steps, data, and expected behavior')}
                  </summary>
                  <dl className="mt-3 space-y-2 whitespace-pre-wrap break-words">
                    <dt className="text-xs text-muted-foreground">
                      {translate('portfolio.scenarioData', 'Preconditions and shared test data')}
                    </dt>
                    <dd>{scenario.testData}</dd>
                    <dt className="text-xs text-muted-foreground">
                      {translate('portfolio.scenarioSteps', 'Test steps')}
                    </dt>
                    <dd>{scenario.steps}</dd>
                    <dt className="text-xs text-muted-foreground">
                      {translate(
                        'portfolio.scenarioExpected',
                        'Expected behavior on both platforms'
                      )}
                    </dt>
                    <dd>{scenario.expected}</dd>
                    {scenario.platformNotes && (
                      <>
                        <dt className="text-xs text-muted-foreground">
                          {translate(
                            'portfolio.scenarioDifferences',
                            'Intentional platform differences (optional)'
                          )}
                        </dt>
                        <dd>{scenario.platformNotes}</dd>
                      </>
                    )}
                  </dl>
                </details>
                <div className="grid grid-cols-1 gap-2 @md/project:grid-cols-2">
                  {cells
                    .filter((entry) => entry.scenario.id === scenario.id)
                    .map((entry) => (
                      <Button
                        key={entry.platform}
                        variant={
                          selected === `${scenario.id}:${entry.platform}` ? 'secondary' : 'outline'
                        }
                        className="h-auto justify-between gap-3 whitespace-normal py-2 text-left"
                        onClick={() => {
                          setSelected(`${scenario.id}:${entry.platform}`)
                          setRecording(false)
                        }}
                      >
                        <span>{entry.platform === 'ios' ? 'iOS' : 'Android'}</span>
                        <span className="text-xs">{resultLabel(entry.result, entry.current)}</span>
                      </Button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          {cell && (
            <section className="space-y-3 rounded-md border border-border p-4">
              <h5 className="break-words text-sm font-medium">
                {cell.platform === 'ios' ? 'iOS' : 'Android'} · {cell.scenario.criterion}
              </h5>
              {cell.result && (
                <PortfolioTestResultReview
                  key={cell.result.id}
                  result={cell.result}
                  current={cell.current}
                  allowFix
                  workItemId={item.id}
                  state={state}
                  busy={busy}
                  onSave={onSave}
                  onSelectTask={onSelectTask}
                />
              )}
              {!locked && !recording && (
                <Button
                  size="sm"
                  disabled={busy || !plan.confirmation || openExecution || editing}
                  onClick={() => setRecording(true)}
                >
                  {translate('portfolio.recordTestResult', 'Record test result')}
                </Button>
              )}
              {openExecution && (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.closeBeforeTesting',
                    'Stop and close linked executions before recording tests.'
                  )}
                </p>
              )}
              {!locked && recording && (
                <PortfolioTestResultForm
                  key={`${plan.version}:${selected}`}
                  workItemId={item.id}
                  planVersion={plan.version}
                  scenarioId={cell.scenario.id}
                  platform={cell.platform}
                  taskSnapshot={verificationTaskSnapshot(state, item.id)}
                  busy={busy || openExecution}
                  onSave={onSave}
                  onClose={() => setRecording(false)}
                />
              )}
            </section>
          )}
          {ready && (
            <p className="text-sm">
              {translate(
                'portfolio.readyForWorkReview',
                'All planned platform checks have reviewed passing evidence. Review linked tasks, then accept the outcome.'
              )}
            </p>
          )}
        </>
      )}
      {verification && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {translate('portfolio.verificationHistory', 'Test plan and result history')}
          </summary>
          <div className="mt-3 space-y-3">
            {verification.plans.toReversed().map((entry) => (
              <details key={entry.version} className="rounded-md border border-border p-3">
                <summary className="cursor-pointer">
                  {translate('portfolio.planVersionHistory', 'Plan v{{version}}', {
                    version: entry.version
                  })}{' '}
                  · {entry.note}
                </summary>
                <p className="my-3 whitespace-pre-wrap break-words">{entry.acceptanceCriteria}</p>
                <p className="mb-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {entry.designReferences} {entry.sourceReference}
                </p>
                {entry.confirmation && <p className="mb-3 text-xs">{entry.confirmation.note}</p>}
                {entry.scenarios.map((scenario) => (
                  <div key={scenario.id} className="mb-3 whitespace-pre-wrap break-words">
                    <p>{scenario.criterion}</p>
                    <p>{scenario.testData}</p>
                    <p>{scenario.steps}</p>
                    <p>{scenario.expected}</p>
                    <p>{scenario.platformNotes}</p>
                  </div>
                ))}
                {verification.results
                  .filter((result) => result.planVersion === entry.version)
                  .toReversed()
                  .map((result) => (
                    <div key={result.id} className="mb-3 space-y-2 border-t border-border pt-3">
                      <p>
                        {result.platform} · {result.outcome} ·{' '}
                        {
                          entry.scenarios.find((scenario) => scenario.id === result.scenarioId)
                            ?.criterion
                        }
                      </p>
                      <PortfolioTestResultReview
                        result={result}
                        current={false}
                        workItemId={item.id}
                        state={state}
                        busy={busy}
                        onSave={onSave}
                        onSelectTask={onSelectTask}
                      />
                    </div>
                  ))}
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
