import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCodeReview } from '../../../../shared/portfolio'
import type { PortfolioTaskStage } from '../../../../shared/portfolio-task-stages'
import { PortfolioField } from './portfolio-controls'
import type { PortfolioTaskReviewComments } from './portfolio-task-review-actions'

// The user's decision on a submitted task. Development records whether the user looked at the
// code, then is accepted or returned; code review and QA are accepted or send findings back.
export function PortfolioTaskDecision({
  stage,
  reviewer,
  evidence,
  acceptBlocker,
  busy,
  note,
  onNoteChange,
  codeReview,
  onCodeReviewChange,
  reviewComments,
  onReviewChanges,
  onAccept,
  onReturn
}: {
  stage: PortfolioTaskStage
  // The user reviews a teammate's PR: findings are theirs to post, with nothing to send back.
  reviewer?: boolean
  evidence: string
  acceptBlocker?: string
  busy: boolean
  note: string
  onNoteChange: (note: string) => void
  codeReview: PortfolioCodeReview | null
  onCodeReviewChange: (choice: PortfolioCodeReview) => void
  reviewComments?: PortfolioTaskReviewComments
  onReviewChanges?: () => void
  onAccept: () => void
  onReturn: () => void
}): React.JSX.Element {
  const development = stage === 'development'
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {development && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{translate('portfolio.codeReview', 'Code review')}</span>
            <span className="text-xs text-muted-foreground">
              {reviewComments?.total
                ? translate(
                    'portfolio.reviewComments',
                    '{{total}} comments · {{unsent}} not sent to the agent',
                    reviewComments
                  )
                : translate('portfolio.reviewNoComments', 'No comments yet')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'portfolio.codeReviewHelp',
              'Optional. Comments you leave on diff lines can be sent to the agent from the diff. Before accepting, record whether you reviewed the code.'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {onReviewChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onCodeReviewChange('reviewed')
                  onReviewChanges()
                }}
              >
                {translate('portfolio.reviewChanges', 'Review changes')}
              </Button>
            )}
            <Button
              variant={codeReview === 'reviewed' ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={codeReview === 'reviewed'}
              onClick={() => onCodeReviewChange('reviewed')}
            >
              {translate('portfolio.codeReviewed', 'I reviewed the code')}
            </Button>
            <Button
              variant={codeReview === 'skipped' ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={codeReview === 'skipped'}
              onClick={() => onCodeReviewChange('skipped')}
            >
              {translate('portfolio.codeReviewSkipped', 'Skip code review')}
            </Button>
          </div>
        </div>
      )}
      {reviewer && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.reviewerDecision',
            'Post the comments you agree with on the PR yourself. Accept when this round is done; when the author pushes again, ask for another round below.'
          )}
        </p>
      )}
      {!reviewer && (
        <PortfolioField
          label={
            development
              ? translate('portfolio.decisionNote', 'Decision note')
              : translate('portfolio.findingsToSend', 'Findings to send back')
          }
        >
          <Textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={
              development
                ? translate(
                    'portfolio.decisionPlaceholder',
                    'Optional when accepting; required when sending back.'
                  )
                : translate(
                    'portfolio.findingsPlaceholder',
                    'The findings development should fix, with their IDs. Leave out the ones you accept as they are.'
                  )
            }
            rows={development ? 3 : 6}
            maxLength={20000}
          />
        </PortfolioField>
      )}
      {!development && !reviewer && (
        <Button variant="ghost" size="sm" onClick={() => onNoteChange(evidence)}>
          {translate('portfolio.useSubmittedFindings', 'Start from the submitted report')}
        </Button>
      )}
      {acceptBlocker && <p className="text-xs text-muted-foreground">{acceptBlocker}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || Boolean(acceptBlocker) || (development && !codeReview)}
          onClick={onAccept}
        >
          {translate('portfolio.accept', 'Accept result')}
        </Button>
        {!reviewer && (
          <Button variant="outline" disabled={busy || !note.trim()} onClick={onReturn}>
            {development
              ? translate('portfolio.reopen', 'Return to planned')
              : translate('portfolio.sendBack', 'Send back to development')}
          </Button>
        )}
      </div>
    </div>
  )
}
