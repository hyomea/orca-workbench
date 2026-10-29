import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PortfolioDiscoveryResult } from '../../../../shared/portfolio-discovery'
import { PortfolioField } from './portfolio-controls'

export function PortfolioDiscoveryReview({
  result,
  feedback,
  onFeedback,
  onRefine,
  disabled
}: {
  result: PortfolioDiscoveryResult
  feedback: string
  onFeedback: (value: string) => void
  onRefine: () => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          {translate('portfolio.projectUnderstanding', 'AI understanding · draft')}
        </h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {result.draft.summary}
        </p>
      </div>
      {result.sources.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {translate('portfolio.inspectedFiles', 'Files read: {{total}}', {
              total: result.sources.length
            })}
          </summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto font-mono scrollbar-sleek">
            {result.sources.map((source, index) => (
              <li key={`${source}:${index}`} className="break-all">
                {source}
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.limited && (
        <p className="text-xs text-muted-foreground">
          {translate(
            'portfolio.scanLimited',
            'This is a bounded sample of project files, not a complete audit.'
          )}
        </p>
      )}
      {result.draft.questions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            {translate('portfolio.questionsToConsider', 'To clarify')}
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {result.draft.questions.map((question, index) => (
              <li key={`${index}:${question}`}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      <PortfolioField
        label={translate('portfolio.refineNotes', 'Add context or correct the draft')}
      >
        <Textarea
          value={feedback}
          onChange={(event) => onFeedback(event.target.value)}
          disabled={disabled}
          rows={3}
          maxLength={4000}
          placeholder={translate(
            'portfolio.refinePlaceholder',
            'For example: this is an exploration hub, not just a ticketing product. Chinese or English is fine.'
          )}
        />
      </PortfolioField>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !feedback.trim()}
        onClick={onRefine}
      >
        {translate('portfolio.refineDraft', 'Refine with AI')}
      </Button>
    </section>
  )
}
