import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioCodeReview } from '../../../../shared/portfolio'
import { PortfolioField } from './portfolio-controls'
import type { PortfolioTaskReviewComments } from './portfolio-task-review-actions'

// The user's decision on a submitted task: an optional but recorded code review, then accept or return.
export function PortfolioTaskDecision({
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
  return (
    <div className="space-y-3 border-t border-border pt-3">
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
      <PortfolioField label={translate('portfolio.decisionNote', 'Decision note')}>
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={translate(
            'portfolio.decisionPlaceholder',
            'Optional when accepting; required when sending back.'
          )}
          rows={3}
          maxLength={20000}
        />
      </PortfolioField>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !codeReview} onClick={onAccept}>
          {translate('portfolio.accept', 'Accept result')}
        </Button>
        <Button variant="outline" disabled={busy || !note.trim()} onClick={onReturn}>
          {translate('portfolio.reopen', 'Return to planned')}
        </Button>
      </div>
    </div>
  )
}
