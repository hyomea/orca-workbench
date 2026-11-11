import { z } from 'zod'

const Id = z.string().trim().min(1).max(4096)

// What "done" means for an outcome, one checkable item at a time: the acceptance criteria, and
// the decisions the user made along the way (such as "no retry on a failed upload"), each with
// where it came from. Every task's agent reads both.
export const PortfolioChecklistKind = z.enum(['criterion', 'decision'])
export type PortfolioChecklistKind = z.infer<typeof PortfolioChecklistKind>

export const PortfolioChecklistItem = z.object({
  id: Id,
  kind: PortfolioChecklistKind,
  text: z.string().trim().min(1).max(2000),
  // Where it came from or why, such as "Proposed by Kiki; agreed for both platforms".
  note: z.string().trim().max(2000).optional(),
  at: z.number()
})
export type PortfolioChecklistItem = z.infer<typeof PortfolioChecklistItem>

export const PortfolioChecklistEntry = PortfolioChecklistItem.omit({ id: true, at: true }).extend({
  // Omitted for a new item; an existing item keeps its id and time.
  id: Id.optional()
})
export type PortfolioChecklistEntry = z.infer<typeof PortfolioChecklistEntry>

// An agent's suggested addition or change, waiting in the outcome's inbox until the user accepts
// (possibly reworded) or dismisses it. Only the user's acceptance changes the checklist.
export const PortfolioChecklistProposalInput = z.object({
  kind: PortfolioChecklistKind,
  text: PortfolioChecklistItem.shape.text,
  reason: z.string().trim().max(4000),
  // The item it rewrites; absent proposes a new one.
  itemId: Id.optional(),
  // The task whose agent proposed it.
  taskId: Id.optional()
})
export const PortfolioChecklistProposal = PortfolioChecklistProposalInput.extend({
  id: Id,
  at: z.number()
})
export type PortfolioChecklistProposal = z.infer<typeof PortfolioChecklistProposal>

type ChecklistOwner = {
  id: string
  acceptanceCriteria: string
  checklist?: PortfolioChecklistItem[]
}

// Criteria written as text, one per line; list markers and blank lines are dropped.
function criteriaLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
}

// An outcome saved before checklists has only its criteria text; read it as items until the
// first checklist change stores them.
export function portfolioChecklist(item: ChecklistOwner): PortfolioChecklistItem[] {
  return (
    item.checklist ??
    criteriaLines(item.acceptanceCriteria).map((text, index) => ({
      id: `${item.id}:criterion:${index + 1}`,
      kind: 'criterion' as const,
      text,
      at: 0
    }))
  )
}

// The criteria as text, which the outcome's editor and its earlier readers use.
export function portfolioCriteriaText(items: readonly PortfolioChecklistItem[]): string {
  return items
    .filter((entry) => entry.kind === 'criterion')
    .map((entry) => `- ${entry.text}`)
    .join('\n')
}

// Everything an agent must meet: the criteria as written (a stored checklist keeps that text in
// step), then the decisions with where they came from.
export function portfolioChecklistText(item: ChecklistOwner): string {
  const decisions = (item.checklist ?? []).filter((entry) => entry.kind === 'decision')
  return [
    item.acceptanceCriteria.trim(),
    ...(decisions.length
      ? [
          `Decisions:\n${decisions
            .map((entry) => `- ${entry.text}${entry.note ? ` (${entry.note})` : ''}`)
            .join('\n')}`
        ]
      : [])
  ]
    .filter(Boolean)
    .join('\n')
}

// New criteria text from the outcome's editor: matching criteria keep their identity, and
// decisions stay as they are.
export function portfolioChecklistWithCriteria(
  item: ChecklistOwner,
  criteria: string,
  now: number
): PortfolioChecklistItem[] {
  const current = portfolioChecklist(item)
  const previous = current.filter((entry) => entry.kind === 'criterion')
  const used = new Set<string>()
  const next = criteriaLines(criteria).map((text, index) => {
    const same = previous.find((entry) => entry.text === text && !used.has(entry.id))
    if (same) {
      used.add(same.id)
      return same
    }
    return {
      id: `${item.id}:criterion:${now}:${index + 1}`,
      kind: 'criterion' as const,
      text,
      at: now
    }
  })
  return [...next, ...current.filter((entry) => entry.kind === 'decision')]
}

// The checklist the user saved: existing items keep their id and time, new ones get both.
export function portfolioChecklistFromEntries(
  item: ChecklistOwner,
  entries: readonly PortfolioChecklistEntry[],
  now: number
): PortfolioChecklistItem[] {
  const current = new Map(portfolioChecklist(item).map((entry) => [entry.id, entry]))
  return entries.map((entry, index) => {
    const existing = entry.id ? current.get(entry.id) : undefined
    const note = entry.note?.trim()
    return {
      id: existing?.id ?? `${item.id}:${entry.kind}:${now}:${index + 1}`,
      kind: entry.kind,
      text: entry.text,
      ...(note ? { note } : {}),
      at:
        existing && existing.text === entry.text && existing.kind === entry.kind ? existing.at : now
    }
  })
}

function kindName(kind: PortfolioChecklistKind): string {
  return kind === 'decision' ? 'decision' : 'criterion'
}

// What changed between two versions of a checklist, one line each, for the agents already
// working on the outcome. Items are matched by id, so a reworded item reads as a change.
export function portfolioChecklistChanges(
  before: readonly PortfolioChecklistItem[],
  after: readonly PortfolioChecklistItem[]
): string[] {
  const previous = new Map(before.map((entry) => [entry.id, entry]))
  const lines: string[] = []
  for (const entry of after) {
    const old = previous.get(entry.id)
    previous.delete(entry.id)
    if (!old) {
      lines.push(`Added ${kindName(entry.kind)}: ${entry.text}`)
    } else if (old.text !== entry.text || old.kind !== entry.kind) {
      lines.push(
        `Changed ${kindName(old.kind)} "${old.text}" to ${kindName(entry.kind)}: ${entry.text}`
      )
    }
  }
  for (const old of previous.values()) {
    lines.push(`Removed ${kindName(old.kind)}: ${old.text}`)
  }
  return lines
}
