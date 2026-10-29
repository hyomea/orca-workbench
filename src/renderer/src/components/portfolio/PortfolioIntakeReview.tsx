import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import type { useFeatureDraft } from './use-feature-draft'
import type { usePortfolioIntake } from './use-portfolio-intake'

export function PortfolioIntakeReview({
  editor,
  intake,
  busy
}: {
  editor: ReturnType<typeof useFeatureDraft>
  intake: ReturnType<typeof usePortfolioIntake>
  busy: boolean
}): React.JSX.Element {
  const { draft, field } = editor
  const result = draft.intakeResult
  const labels = {
    title: translate('portfolio.name', 'Name'),
    description: translate('portfolio.changeDescription', 'Problem or proposed change'),
    acceptanceCriteria: translate('portfolio.acceptanceCriteria', 'Acceptance criteria'),
    designReferences: translate('portfolio.designReferences', 'Design references and notes'),
    sourceReference: translate('portfolio.sourceReference', 'Jira or source reference')
  }
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <PortfolioSelect
          label={translate('portfolio.agent', 'Agent')}
          value={draft.intakeAgent ?? 'codex'}
          onChange={(value) => field('intakeAgent', value)}
          disabled={busy}
          options={[
            { id: 'codex', name: 'Codex' },
            { id: 'claude', name: 'Claude' }
          ]}
        />
        <PortfolioSelect
          label={translate('portfolio.responseLanguage', 'Response language')}
          value={draft.intakeLanguage ?? 'en'}
          onChange={(value) => field('intakeLanguage', value)}
          disabled={busy}
          options={[
            { id: 'en', name: 'English' },
            { id: 'zh', name: '中文' }
          ]}
        />
      </div>
      {(draft.intakeSources?.length ?? 0) > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {translate(
              'portfolio.intakeReviewHint',
              'Review the filled draft below. Your existing edits are kept; suggested replacements are optional.'
            )}
          </p>
          {result && (
            <>
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {translate('portfolio.sourceAccessReport', 'Source access report')}
                </summary>
                <ul className="mt-3 space-y-3 text-sm">
                  {result.sources.map((source) => (
                    <li key={source.url}>
                      <p className="break-all font-medium">{source.url}</p>
                      <p>
                        {source.status === 'read'
                          ? translate('portfolio.sourceRead', 'Read')
                          : translate('portfolio.sourceUnavailable', 'Could not read')}{' '}
                        · {source.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
              {result.sources.some((source) => source.status === 'unavailable') && (
                <p role="status" className="text-sm text-muted-foreground">
                  {translate(
                    'portfolio.intakeSourceUnavailable',
                    'Some sources could not be read. Check the access report before confirming the draft.'
                  )}
                </p>
              )}
              {result.questions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">
                    {translate(
                      'portfolio.intakeQuestions',
                      'Only these details need clarification'
                    )}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {result.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(
                [
                  'title',
                  'description',
                  'acceptanceCriteria',
                  'designReferences',
                  'sourceReference'
                ] as const
              )
                .filter((key) => result.fields[key] && draft[key] !== result.fields[key])
                .map((key) => (
                  <details key={key} className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-sm">
                      {translate('portfolio.intakeSuggestion', 'Suggestion for {{field}}', {
                        field: labels[key]
                      })}
                    </summary>
                    <p className="my-3 whitespace-pre-wrap break-words text-sm">
                      {result.fields[key]}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => field(key, result.fields[key])}
                    >
                      {translate('portfolio.useSuggestion', 'Use suggestion')}
                    </Button>
                  </details>
                ))}
            </>
          )}
          <PortfolioField
            label={translate('portfolio.intakeCorrections', 'Answers or corrections (optional)')}
          >
            <Textarea
              rows={2}
              maxLength={10000}
              value={draft.intakeNotes ?? ''}
              disabled={busy}
              onChange={(event) => field('intakeNotes', event.target.value)}
            />
          </PortfolioField>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void intake.analyze()}
            >
              {translate('portfolio.refineIntake', 'Refine draft with AI')}
            </Button>
            {intake.pending && (
              <Button type="button" variant="outline" size="sm" onClick={() => void intake.stop()}>
                {translate('portfolio.stopIntake', 'Stop analysis')}
              </Button>
            )}
          </div>
        </>
      )}
      {intake.error && (
        <p role="alert" className="text-sm text-destructive">
          {intake.error}
        </p>
      )}
    </section>
  )
}
