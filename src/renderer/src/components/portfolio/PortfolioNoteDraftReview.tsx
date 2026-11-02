import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  PortfolioNote,
  PortfolioNoteContent,
  PortfolioNoteDraft
} from '../../../../shared/portfolio-notes'
import { PortfolioNoteEditor } from './PortfolioNoteEditor'
import { NoteText } from './PortfolioNoteImport'

export function PortfolioNoteDraftReview({
  draft,
  current,
  taskTitle,
  busy,
  onAccept,
  onDismiss,
  onCancel
}: {
  draft: PortfolioNoteDraft
  current?: PortfolioNote
  taskTitle?: string
  busy: boolean
  onAccept: (note: PortfolioNoteContent) => void
  onDismiss: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">
          {current
            ? translate('portfolio.reviewNoteUpdate', 'Proposed update to “{{title}}”', {
                title: current.title
              })
            : translate('portfolio.reviewNewNote', 'Proposed new note')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {taskTitle
            ? translate('portfolio.noteProposedByTask', 'From task: {{title}}', {
                title: taskTitle
              })
            : translate('portfolio.noteProposedByAgent', 'Proposed by an agent')}
        </p>
        {draft.reason && <p className="whitespace-pre-wrap break-words text-sm">{draft.reason}</p>}
        {current && draft.baseVersion !== current.version && (
          <p role="status" className="text-sm text-destructive">
            {translate(
              'portfolio.noteChangedSinceProposal',
              'The note changed after this proposal. Compare carefully before accepting.'
            )}
          </p>
        )}
      </div>
      {current && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {translate('portfolio.showCurrentNote', 'Show current note')}
          </summary>
          <div className="mt-2">
            <NoteText label={translate('portfolio.currentNote', 'Current')} text={current.body} />
          </div>
        </details>
      )}
      <PortfolioNoteEditor
        initial={{
          title: draft.title,
          body: draft.body,
          agentContext: current?.agentContext ?? true
        }}
        busy={busy}
        submitLabel={translate('portfolio.acceptProposal', 'Accept proposal')}
        onSubmit={onAccept}
        onCancel={onCancel}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={onDismiss}>
        {translate('portfolio.dismissProposal', 'Dismiss proposal')}
      </Button>
    </section>
  )
}
