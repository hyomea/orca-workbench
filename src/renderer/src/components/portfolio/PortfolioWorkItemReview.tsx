import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioField } from './portfolio-controls'
import { workItemStatuses } from './portfolio-feature-labels'

export function PortfolioWorkItemReview({
  item,
  feature,
  tasks,
  verificationReady,
  busy,
  onSave
}: {
  item: PortfolioWorkItem
  feature: PortfolioFeature
  tasks: PortfolioState['tasks']
  verificationReady: boolean
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const published = feature.versions.some((version) => version.workItemId === item.id)
  const openExecution = tasks.some((task) => {
    const attempt = task.attempts.at(-1)
    return attempt && attempt.state !== 'closed'
  })
  const statuses = workItemStatuses().filter(
    (entry) => entry.id !== item.status && (entry.id !== 'accepted' || item.status === 'review')
  )
  async function save(command: PortfolioCommand): Promise<void> {
    if (await onSave(command)) {
      setNote('')
      setConfirmPublish(false)
    }
  }
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">
        {translate('portfolio.workItemReview', 'Work item review')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.workReviewHint',
          'Acceptance requires reviewed platform evidence, accepted tasks, and closed executions. Triage only accepts investigation findings. Acceptance does not release the app.'
        )}
      </p>
      {!verificationReady && item.kind !== 'investigation' && (
        <p className="text-sm">
          {translate(
            'portfolio.verificationRequired',
            'Complete Parity & tests: confirm coverage and review passing evidence for every scenario on both platforms.'
          )}
        </p>
      )}
      {tasks.some((task) => task.status !== 'accepted') && (
        <p className="text-sm">
          {translate(
            'portfolio.tasksNeedAcceptance',
            'Review and accept all linked tasks before accepting this work item.'
          )}
        </p>
      )}
      {openExecution && (
        <p className="text-sm">
          {translate(
            'portfolio.executionsNeedClosing',
            'Stop and close all linked executions before acceptance.'
          )}
        </p>
      )}
      {!published && (
        <>
          <PortfolioField label={translate('portfolio.reviewNote', 'Evidence or review note')}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={12000}
              disabled={busy}
            />
          </PortfolioField>
          <div className="flex flex-wrap gap-2">
            {statuses.map((entry) => (
              <Button
                key={entry.id}
                variant="outline"
                size="sm"
                disabled={
                  busy ||
                  !note.trim() ||
                  ((entry.id === 'accepted' || entry.id === 'planned') && !!openExecution) ||
                  (entry.id === 'accepted' &&
                    (tasks.some((task) => task.status !== 'accepted') ||
                      (item.kind !== 'investigation' && !verificationReady)))
                }
                onClick={() => {
                  const status = entry.id
                  if (
                    status === 'planned' ||
                    status === 'active' ||
                    status === 'blocked' ||
                    status === 'review' ||
                    status === 'accepted'
                  ) {
                    void save({ kind: 'workItem.transition', workItemId: item.id, status, note })
                  }
                }}
              >
                {entry.name}
              </Button>
            ))}
          </div>
          {item.status === 'accepted' &&
            (item.kind === 'initial' || item.kind === 'improvement') && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.publishHint',
                    'Publishing makes this work item’s complete specification current for the feature. Previous versions and execution prompts are retained.'
                  )}
                </p>
                {item.baseVersion !== (feature.versions.at(-1)?.version ?? 0) ? (
                  <p className="text-sm">
                    {translate(
                      'portfolio.staleSpecification',
                      'The current specification has changed. Create a follow-up against the latest version before publishing.'
                    )}
                  </p>
                ) : (
                  <>
                    {confirmPublish && (
                      <p role="alert" className="text-sm">
                        {translate(
                          'portfolio.confirmPublishHint',
                          'Replace the current specification with this accepted proposal?'
                        )}
                      </p>
                    )}
                    <Button
                      size="sm"
                      disabled={
                        busy ||
                        !note.trim() ||
                        !item.acceptanceCriteria.trim() ||
                        !verificationReady
                      }
                      onClick={() => {
                        if (!confirmPublish) {
                          setConfirmPublish(true)
                        } else {
                          void save({ kind: 'feature.publish', workItemId: item.id, note })
                        }
                      }}
                    >
                      {confirmPublish
                        ? translate('portfolio.confirmPublication', 'Confirm publication')
                        : translate(
                            'portfolio.publishSpecification',
                            'Publish as current specification'
                          )}
                    </Button>
                  </>
                )}
              </div>
            )}
        </>
      )}
      {published && (
        <p className="text-sm">
          {translate(
            'portfolio.publishedWorkHint',
            'This work published a specification. Create a new work item for further changes.'
          )}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer">{translate('portfolio.history', 'History')}</summary>
        <div className="mt-3 space-y-3">
          {item.history.map((entry) => (
            <p key={entry.id} className="whitespace-pre-wrap border-l border-border pl-3">
              <span className="text-xs text-muted-foreground">
                {workItemStatuses().find((status) => status.id === entry.status)?.name}
              </span>
              <br />
              {entry.note}
            </p>
          ))}
        </div>
      </details>
    </section>
  )
}
