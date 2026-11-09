import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import type { PortfolioFeature, PortfolioWorkItem } from '../../../../shared/portfolio-features'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { workItemStatuses } from './portfolio-feature-labels'

export function PortfolioWorkItemReview({
  item,
  feature,
  features,
  tasks,
  verificationReady,
  busy,
  onSave
}: {
  item: PortfolioWorkItem
  feature: PortfolioFeature | undefined
  // The initiative's features, offered when an outcome without one publishes a specification.
  features: readonly PortfolioFeature[]
  tasks: PortfolioState['tasks']
  verificationReady: boolean
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [targetId, setTargetId] = useState(feature?.id ?? '')
  const target = feature ?? features.find((entry) => entry.id === targetId)
  const published = !!feature?.versions.some((version) => version.workItemId === item.id)
  const openExecution = tasks.some((task) => {
    const attempt = task.attempts.at(-1)
    return attempt && attempt.state !== 'closed'
  })
  const signedOff = item.status === 'accepted'
  const tasksOpen = tasks.some((task) => task.status !== 'accepted')
  async function save(command: PortfolioCommand): Promise<void> {
    if (await onSave(command)) {
      setNote('')
      setConfirmPublish(false)
    }
  }
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">
        {translate('portfolio.workItemReview', 'Outcome sign-off')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {translate(
          'portfolio.workReviewHint',
          'Sign-off requires accepted tasks and closed executions. An outcome that must behave the same on iOS and Android also needs reviewed evidence on both. Signing off does not release the app.'
        )}
      </p>
      {!verificationReady && item.parity && item.kind !== 'investigation' && (
        <p className="text-sm">
          {translate(
            'portfolio.verificationRequired',
            'Complete Parity & tests: confirm coverage and review passing evidence for every scenario on both platforms.'
          )}
        </p>
      )}
      {!signedOff && tasksOpen && (
        <p className="text-sm">
          {translate(
            'portfolio.tasksNeedAcceptance',
            'Accept every stage on the Tasks page before signing off this outcome.'
          )}
        </p>
      )}
      {openExecution && (
        <p className="text-sm">
          {translate(
            'portfolio.executionsNeedClosing',
            'Stop and close all linked executions before signing off or reopening.'
          )}
        </p>
      )}
      {!published && (
        <>
          <PortfolioField label={translate('portfolio.signOffNote', 'Sign-off note')}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={12000}
              disabled={busy}
            />
          </PortfolioField>
          <div className="flex flex-wrap gap-2">
            {signedOff ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !note.trim() || openExecution}
                onClick={() =>
                  void save({
                    kind: 'workItem.transition',
                    workItemId: item.id,
                    status: 'planned',
                    note
                  })
                }
              >
                {translate('portfolio.reopenOutcome', 'Reopen')}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={
                  busy ||
                  !note.trim() ||
                  openExecution ||
                  tasksOpen ||
                  (item.parity && item.kind !== 'investigation' && !verificationReady)
                }
                onClick={() =>
                  void save({
                    kind: 'workItem.transition',
                    workItemId: item.id,
                    status: 'accepted',
                    note
                  })
                }
              >
                {translate('portfolio.signOff', 'Sign off')}
              </Button>
            )}
          </div>
          {item.status === 'accepted' &&
            (item.kind === 'initial' || item.kind === 'improvement') && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.publishHint',
                    'Publishing makes this outcome’s complete specification current for the feature. Previous versions and execution prompts are retained.'
                  )}
                </p>
                {!feature && (
                  <PortfolioSelect
                    label={translate('portfolio.publishFeature', 'Feature to update')}
                    value={targetId}
                    onChange={setTargetId}
                    disabled={busy}
                    options={features.map((entry) => ({ id: entry.id, name: entry.name }))}
                  />
                )}
                {feature && item.baseVersion !== (feature.versions.at(-1)?.version ?? 0) ? (
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
                        !target ||
                        (item.parity && !verificationReady)
                      }
                      onClick={() => {
                        if (!confirmPublish) {
                          setConfirmPublish(true)
                        } else {
                          void save({
                            kind: 'feature.publish',
                            workItemId: item.id,
                            note,
                            ...(feature ? {} : { featureId: target?.id })
                          })
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
            'This work published a specification. Create a new outcome for further changes.'
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
