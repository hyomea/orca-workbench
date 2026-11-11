import { useRef, useState } from 'react'
import { Download, NotebookPen, Plus, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import { parsePortfolioNoteMarkdown } from '../../../../shared/portfolio-note-markdown'
import {
  planPortfolioNoteImport,
  portfolioNoteImportEntries,
  type PortfolioNoteImportRow
} from '../../../../shared/portfolio-note-import'
import { MAX_PORTFOLIO_NOTE_CHARACTERS } from '../../../../shared/portfolio-notes'
import { PortfolioNoteDraftReview } from './PortfolioNoteDraftReview'
import { PortfolioNoteEditor } from './PortfolioNoteEditor'
import { PortfolioNoteImport } from './PortfolioNoteImport'

export type PortfolioNotesExport = (
  projectId: string
) => Promise<{ directory: string; written: number } | null>

type Mode =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'draft'; id: string }
  | { kind: 'import'; rows: PortfolioNoteImportRow[]; problems: string[] }

export function PortfolioNotes({
  state,
  projectId,
  busy,
  onSave,
  onExport,
  openDraftId
}: {
  state: PortfolioState
  projectId: string
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onExport: PortfolioNotesExport
  // A proposal to open straight away, such as one chosen from an outcome's inbox.
  openDraftId?: string
}): React.JSX.Element {
  const [mode, setMode] = useState<Mode>(
    openDraftId ? { kind: 'draft', id: openDraftId } : { kind: 'list' }
  )
  const [status, setStatus] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const notes = state.notes
    .filter((note) => note.projectId === projectId)
    .sort((a, b) => a.title.localeCompare(b.title))
  const drafts = state.noteDrafts.filter((draft) => draft.projectId === projectId)
  const save = async (command: PortfolioCommand): Promise<void> => {
    if (await onSave(command)) {
      setMode({ kind: 'list' })
    }
  }

  async function readFiles(files: FileList): Promise<void> {
    const parsed: Parameters<typeof planPortfolioNoteImport>[1][number][] = []
    const problems: string[] = []
    for (const file of [...files].slice(0, 200)) {
      const text = await file.text()
      if (text.length > MAX_PORTFOLIO_NOTE_CHARACTERS + 2000) {
        problems.push(
          translate('portfolio.noteFileTooLarge', '{{file}} is too large to import.', {
            file: file.name
          })
        )
        continue
      }
      try {
        parsed.push({ file: file.name, parsed: parsePortfolioNoteMarkdown(text, file.name) })
      } catch {
        problems.push(
          translate('portfolio.noteFileUnreadable', '{{file}} is not a readable note.', {
            file: file.name
          })
        )
      }
    }
    setMode({ kind: 'import', rows: planPortfolioNoteImport(notes, parsed), problems })
  }

  if (mode.kind === 'new') {
    return (
      <PortfolioNoteEditor
        initial={{ title: '', body: '', agentContext: true }}
        busy={busy}
        submitLabel={translate('portfolio.createNote', 'Create note')}
        onSubmit={(note) => void save({ kind: 'note.create', projectId, note })}
        onCancel={() => setMode({ kind: 'list' })}
      />
    )
  }
  const editing = mode.kind === 'edit' && notes.find((note) => note.id === mode.id)
  if (editing) {
    return (
      <PortfolioNoteEditor
        key={`${editing.id}:${editing.version}`}
        initial={{ title: editing.title, body: editing.body, agentContext: editing.agentContext }}
        busy={busy}
        submitLabel={translate('portfolio.save', 'Save')}
        onSubmit={(note) =>
          void save({
            kind: 'note.update',
            noteId: editing.id,
            expectedVersion: editing.version,
            note
          })
        }
        onCancel={() => setMode({ kind: 'list' })}
        onDelete={() =>
          void save({ kind: 'note.delete', noteId: editing.id, expectedVersion: editing.version })
        }
      />
    )
  }
  const draft = mode.kind === 'draft' && drafts.find((entry) => entry.id === mode.id)
  if (draft) {
    const current = notes.find((note) => note.id === draft.noteId)
    return (
      <PortfolioNoteDraftReview
        key={`${draft.id}:${current?.version ?? 0}`}
        draft={draft}
        current={current}
        taskTitle={state.tasks.find((task) => task.id === draft.taskId)?.title}
        busy={busy}
        onAccept={(note) =>
          void save({
            kind: 'noteDraft.accept',
            draftId: draft.id,
            note,
            ...(current ? { expectedVersion: current.version } : {})
          })
        }
        onDismiss={() => void save({ kind: 'noteDraft.dismiss', draftId: draft.id })}
        onCancel={() => setMode({ kind: 'list' })}
      />
    )
  }
  if (mode.kind === 'import') {
    return (
      <PortfolioNoteImport
        rows={mode.rows}
        problems={mode.problems}
        busy={busy}
        onConfirm={(rows) => {
          const entries = portfolioNoteImportEntries(rows)
          if (entries.length) {
            void save({ kind: 'note.import', projectId, entries })
          }
        }}
        onCancel={() => setMode({ kind: 'list' })}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 @2xl/project:flex-row">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{translate('portfolio.notes', 'Notes')}</h3>
          <p className="max-w-xl text-xs text-muted-foreground">
            {translate(
              'portfolio.notesHint',
              'Durable knowledge about this initiative for you and your agents. Agents can propose changes; you decide what is kept.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            multiple
            hidden
            onChange={(event) => {
              const files = event.target.files
              if (files?.length) {
                void readFiles(files)
              }
              event.target.value = ''
            }}
          />
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload aria-hidden="true" />
            {translate('portfolio.importNotes', 'Import')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || notes.length === 0}
            onClick={async () => {
              setStatus('')
              try {
                const result = await onExport(projectId)
                if (result) {
                  setStatus(
                    translate(
                      'portfolio.notesExported',
                      'Exported {{count}} notes to {{directory}}',
                      {
                        count: result.written,
                        directory: result.directory
                      }
                    )
                  )
                }
              } catch (failure) {
                setStatus(failure instanceof Error ? failure.message : String(failure))
              }
            }}
          >
            <Download aria-hidden="true" />
            {translate('portfolio.exportNotes', 'Export')}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => setMode({ kind: 'new' })}>
            <Plus aria-hidden="true" />
            {translate('portfolio.newNote', 'New note')}
          </Button>
        </div>
      </div>
      {status && (
        <p role="status" className="break-all text-xs text-muted-foreground">
          {status}
        </p>
      )}
      {drafts.length > 0 && (
        <section className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <h4 className="text-sm font-medium">
            {translate('portfolio.noteProposals', 'Agent proposals · {{count}}', {
              count: drafts.length
            })}
          </h4>
          <ul className="space-y-1">
            {drafts.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setMode({ kind: 'draft', id: entry.id })}
                >
                  <span className="break-words">{entry.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {entry.noteId
                      ? translate('portfolio.proposalUpdate', 'Update')
                      : translate('portfolio.proposalNew', 'New')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {notes.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-2 px-3 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setMode({ kind: 'edit', id: note.id })}
              >
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{note.title}</span>
                {note.agentContext && (
                  <Badge variant="outline">
                    {translate('portfolio.noteForAgents', 'For agents')}
                  </Badge>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
          <NotebookPen className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            {translate(
              'portfolio.noNotes',
              'No notes yet. Write one, or import Markdown files you already keep.'
            )}
          </p>
        </section>
      )}
    </div>
  )
}
