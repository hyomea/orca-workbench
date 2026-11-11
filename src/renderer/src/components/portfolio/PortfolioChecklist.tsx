import { useState } from 'react'
import { CircleCheck, Plus, Scale, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import {
  portfolioChecklist,
  type PortfolioChecklistEntry,
  type PortfolioChecklistKind
} from '../../../../shared/portfolio-checklist'
import type { PortfolioWorkItem } from '../../../../shared/portfolio-features'

function kindName(kind: PortfolioChecklistKind): string {
  return kind === 'decision'
    ? translate('portfolio.checklistDecisions', 'Decisions')
    : translate('portfolio.checklistCriteria', 'Acceptance criteria')
}

function Items({
  kind,
  entries
}: {
  kind: PortfolioChecklistKind
  entries: readonly PortfolioChecklistEntry[]
}): React.JSX.Element | null {
  const own = entries.filter((entry) => entry.kind === kind)
  if (!own.length) {
    return null
  }
  const Icon = kind === 'decision' ? Scale : CircleCheck
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{kindName(kind)}</h4>
      <ul className="space-y-1.5">
        {own.map((entry) => (
          <li key={entry.id ?? entry.text} className="flex gap-2 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {entry.text}
              {entry.note && (
                <span className="block text-xs text-muted-foreground">{entry.note}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// What "done" means for the outcome: its acceptance criteria and the decisions made along the
// way. It can change while the work runs, until sign-off; every task's agent reads it.
export function PortfolioChecklist({
  item,
  editable,
  busy,
  onSave
}: {
  item: PortfolioWorkItem
  editable: boolean
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const saved = portfolioChecklist(item)
  const [draft, setDraft] = useState<PortfolioChecklistEntry[] | null>(null)
  const change = (index: number, patch: Partial<PortfolioChecklistEntry>) =>
    setDraft((current) =>
      (current ?? []).map((entry, at) => (at === index ? { ...entry, ...patch } : entry))
    )
  if (!draft) {
    return (
      <section
        aria-label={translate('portfolio.checklist', 'Checklist')}
        className="space-y-3 rounded-md border border-border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{translate('portfolio.checklist', 'Checklist')}</h3>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                setDraft(saved.map(({ id, kind, text, note }) => ({ id, kind, text, note })))
              }
            >
              {translate('portfolio.editChecklist', 'Edit checklist')}
            </Button>
          )}
        </div>
        {saved.length ? (
          <>
            <Items kind="criterion" entries={saved} />
            <Items kind="decision" entries={saved} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate(
              'portfolio.checklistEmpty',
              'No acceptance criteria yet. Add what must be true for this outcome to be done.'
            )}
          </p>
        )}
      </section>
    )
  }
  const usable = draft.filter((entry) => entry.text.trim())
  return (
    <section
      aria-label={translate('portfolio.checklist', 'Checklist')}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <h3 className="text-sm font-medium">{translate('portfolio.checklist', 'Checklist')}</h3>
      <ul className="space-y-2">
        {draft.map((entry, index) => (
          <li key={entry.id ?? `new:${index}`} className="space-y-1.5 rounded-md bg-muted/40 p-2">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">
                {entry.kind === 'decision'
                  ? translate('portfolio.checklistDecision', 'Decision')
                  : translate('portfolio.checklistCriterion', 'Criterion')}
              </span>
              <Input
                aria-label={translate('portfolio.checklistText', 'Checklist item')}
                value={entry.text}
                maxLength={2000}
                onChange={(event) => change(index, { text: event.target.value })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={translate('portfolio.removeChecklistItem', 'Remove item')}
                onClick={() => setDraft(draft.filter((_, at) => at !== index))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Input
              aria-label={translate('portfolio.checklistNote', 'Where it came from')}
              placeholder={translate(
                'portfolio.checklistNotePlaceholder',
                'Where it came from or why (optional)'
              )}
              value={entry.note ?? ''}
              maxLength={2000}
              onChange={(event) => change(index, { note: event.target.value })}
              className="ml-30 w-auto text-xs"
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['criterion', 'decision'] as const).map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              onClick={() => setDraft([...draft, { kind, text: '' }])}
            >
              <Plus aria-hidden="true" />
              {kind === 'decision'
                ? translate('portfolio.addDecision', 'Add decision')
                : translate('portfolio.addCriterion', 'Add criterion')}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDraft(null)}>
            {translate('portfolio.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (
                await onSave({ kind: 'workItem.checklist', workItemId: item.id, items: usable })
              ) {
                setDraft(null)
              }
            }}
          >
            {translate('portfolio.saveChecklist', 'Save checklist')}
          </Button>
        </div>
      </div>
    </section>
  )
}
