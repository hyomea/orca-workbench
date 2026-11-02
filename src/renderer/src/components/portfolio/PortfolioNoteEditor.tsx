import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  MAX_PORTFOLIO_NOTE_CHARACTERS,
  type PortfolioNoteContent
} from '../../../../shared/portfolio-notes'
import { PortfolioField } from './portfolio-controls'

export function PortfolioNoteEditor({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete
}: {
  initial: PortfolioNoteContent
  busy: boolean
  submitLabel: string
  onSubmit: (note: PortfolioNoteContent) => void
  onCancel: () => void
  onDelete?: () => void
}): React.JSX.Element {
  const [note, setNote] = useState(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ ...note, title: note.title.trim() })
      }}
    >
      <PortfolioField label={translate('portfolio.noteTitle', 'Title')}>
        <Input
          value={note.title}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setNote({ ...note, title: event.target.value })}
        />
      </PortfolioField>
      <PortfolioField label={translate('portfolio.noteBody', 'Markdown')}>
        <Textarea
          value={note.body}
          rows={16}
          maxLength={MAX_PORTFOLIO_NOTE_CHARACTERS}
          disabled={busy}
          className="font-mono text-xs"
          onChange={(event) => setNote({ ...note, body: event.target.value })}
        />
      </PortfolioField>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={note.agentContext}
          disabled={busy}
          onCheckedChange={(checked) => setNote({ ...note, agentContext: checked === true })}
        />
        <span>
          {translate('portfolio.noteAgentContext', 'Offer to agents')}
          <span className="block text-xs text-muted-foreground">
            {translate(
              'portfolio.noteAgentContextHint',
              'Task prompts list this note’s title and a read-only file path.'
            )}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || !note.title.trim()}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          {translate('portfolio.cancel', 'Cancel')}
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          >
            {confirmDelete
              ? translate('portfolio.confirmDeleteNote', 'Confirm delete')
              : translate('portfolio.deleteNote', 'Delete note')}
          </Button>
        )}
      </div>
    </form>
  )
}
