import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import type { PortfolioNoteImportRow } from '../../../../shared/portfolio-note-import'

export function PortfolioNoteImport({
  rows,
  problems,
  busy,
  onConfirm,
  onCancel
}: {
  rows: PortfolioNoteImportRow[]
  problems: string[]
  busy: boolean
  onConfirm: (rows: PortfolioNoteImportRow[]) => void
  onCancel: () => void
}): React.JSX.Element {
  // Replacing an existing note needs an explicit choice after the differences are visible.
  const [chosen, setChosen] = useState(
    () => new Set(rows.flatMap((row, index) => (row.status === 'new' ? [index] : [])))
  )
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">
        {translate('portfolio.importNotesReview', 'Review imported notes')}
      </h3>
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <ul className="divide-y divide-border border-y border-border">
        {rows.map((row, index) => (
          <li key={`${row.file}:${index}`} className="space-y-2 py-3">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={chosen.has(index)}
                disabled={busy || row.status === 'unchanged'}
                onCheckedChange={(checked) =>
                  setChosen((current) => {
                    const next = new Set(current)
                    if (checked === true) {
                      next.add(index)
                    } else {
                      next.delete(index)
                    }
                    return next
                  })
                }
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block break-words font-medium">{row.parsed.note.title}</span>
                <span className="block break-all font-mono text-xs text-muted-foreground">
                  {row.file}
                </span>
              </span>
              <Badge variant="outline">
                {row.status === 'new'
                  ? translate('portfolio.importNew', 'New note')
                  : row.status === 'changed'
                    ? translate('portfolio.importReplaces', 'Replaces existing')
                    : translate('portfolio.importUnchanged', 'Unchanged')}
              </Badge>
            </label>
            {row.status === 'changed' && row.match && (
              <details className="ml-7 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {translate('portfolio.compareNote', 'Compare with “{{title}}”', {
                    title: row.match.title
                  })}
                </summary>
                <div className="mt-2 grid gap-2 @2xl/project:grid-cols-2">
                  <NoteText
                    label={translate('portfolio.currentNote', 'Current')}
                    text={row.match.body}
                  />
                  <NoteText
                    label={translate('portfolio.importedNote', 'Imported')}
                    text={row.parsed.note.body}
                  />
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || chosen.size === 0}
          onClick={() => onConfirm(rows.filter((_, index) => chosen.has(index)))}
        >
          {translate('portfolio.importSelectedNotes', 'Import {{count}} selected', {
            count: chosen.size
          })}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          {translate('portfolio.cancel', 'Cancel')}
        </Button>
      </div>
    </section>
  )
}

export function NoteText({ label, text }: { label: string; text: string }): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <span className="font-medium">{label}</span>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 font-mono scrollbar-sleek">
        {text}
      </pre>
    </div>
  )
}
