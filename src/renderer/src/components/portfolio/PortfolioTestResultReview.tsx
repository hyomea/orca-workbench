import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getIntlLocale, translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabel, portfolioWorkingRoles } from '../../../../shared/portfolio-roles'
import type { PortfolioTestResult } from '../../../../shared/portfolio-verification'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'

export function PortfolioTestResultReview({
  result,
  current,
  allowFix = current,
  workItemId,
  state,
  busy,
  onSave,
  onSelectTask
}: {
  result: PortfolioTestResult
  current: boolean
  allowFix?: boolean
  workItemId: string
  state: PortfolioState
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onSelectTask: (id: string) => void
}) {
  const [note, setNote] = useState('')
  const [roleId, setRoleId] = useState('')
  const accepted = state.workItems.find((item) => item.id === workItemId)?.status === 'accepted'
  return (
    <div className="space-y-3 text-sm">
      <p className="break-words text-xs text-muted-foreground">
        {result.build} · {result.environment} ·{' '}
        {new Date(result.at).toLocaleString(getIntlLocale())}
      </p>
      <p className="whitespace-pre-wrap break-words">{result.evidence}</p>
      {result.review && (
        <p className="whitespace-pre-wrap break-words border-l border-border pl-3">
          {result.review.decision === 'approved'
            ? translate('portfolio.evidenceApproved', 'Evidence approved')
            : translate('portfolio.evidenceRejected', 'Evidence rejected')}
          : {result.review.note}
        </p>
      )}
      {current && !accepted && !result.review && (
        <>
          <PortfolioField label={translate('portfolio.evidenceReviewNote', 'Evidence review note')}>
            <Textarea
              rows={2}
              maxLength={12000}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </PortfolioField>
          <div className="flex flex-wrap gap-2">
            {(['approved', 'rejected'] as const).map((decision) => (
              <Button
                key={decision}
                variant="outline"
                size="sm"
                disabled={busy || !note.trim()}
                onClick={async () => {
                  if (
                    await onSave({
                      kind: 'verification.review',
                      workItemId,
                      resultId: result.id,
                      decision,
                      note
                    })
                  ) {
                    setNote('')
                  }
                }}
              >
                {decision === 'approved'
                  ? translate('portfolio.approveEvidence', 'Approve evidence')
                  : translate('portfolio.rejectEvidence', 'Reject evidence')}
              </Button>
            ))}
          </div>
        </>
      )}
      {result.fixTaskId ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => result.fixTaskId && onSelectTask(result.fixTaskId)}
        >
          {translate('portfolio.openFixTask', 'Open fix task')}
        </Button>
      ) : (
        allowFix &&
        !accepted &&
        (result.outcome !== 'pass' || result.review?.decision === 'rejected') && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {translate(
                'portfolio.fixTaskHint',
                'Assign this finding to a role. The fix becomes a linked task; both platforms need fresh results after the work changes.'
              )}
            </p>
            <PortfolioSelect
              label={translate('portfolio.fixRole', 'Role for the fix')}
              value={roleId}
              onChange={setRoleId}
              disabled={busy}
              options={portfolioWorkingRoles(state).map((role) => ({
                id: role.id,
                name: portfolioRoleLabel(role)
              }))}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !roleId}
              onClick={() =>
                void onSave({ kind: 'verification.fix', workItemId, resultId: result.id, roleId })
              }
            >
              {translate('portfolio.createFixTask', 'Create fix task')}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
