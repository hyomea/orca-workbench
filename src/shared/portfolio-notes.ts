import { z } from 'zod'
import type { PortfolioState } from './portfolio'

const Id = z.string().trim().min(1).max(4096)
export const MAX_PORTFOLIO_NOTE_CHARACTERS = 100_000
const MAX_DRAFTS_PER_PROJECT = 50
export const PortfolioNoteContent = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_PORTFOLIO_NOTE_CHARACTERS),
  agentContext: z.boolean()
})
export const PortfolioNote = PortfolioNoteContent.extend({
  id: Id,
  projectId: Id,
  version: z.number().int().positive(),
  createdAt: z.number(),
  updatedAt: z.number()
})
export const PortfolioNoteDraftInput = z.object({
  projectId: Id,
  noteId: Id.optional(),
  taskId: Id.optional(),
  // The outcome it concerns, so its coordinator and inbox show it; a task's outcome by default.
  workItemId: Id.optional(),
  title: PortfolioNoteContent.shape.title,
  body: PortfolioNoteContent.shape.body,
  reason: z.string().trim().max(4000)
})
export const PortfolioNoteDraft = PortfolioNoteDraftInput.extend({
  id: Id,
  baseVersion: z.number().int().positive().optional(),
  at: z.number()
})
export type PortfolioNoteContent = z.infer<typeof PortfolioNoteContent>
export type PortfolioNote = z.infer<typeof PortfolioNote>
export type PortfolioNoteDraft = z.infer<typeof PortfolioNoteDraft>

const ImportEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create'), note: PortfolioNoteContent }),
  z.object({
    kind: z.literal('replace'),
    noteId: Id,
    expectedVersion: z.number().int().positive(),
    note: PortfolioNoteContent
  })
])
export type PortfolioNoteImportEntry = z.infer<typeof ImportEntry>

export const PortfolioNoteCommands = [
  z.object({ kind: z.literal('note.create'), projectId: Id, note: PortfolioNoteContent }),
  z.object({
    kind: z.literal('note.update'),
    noteId: Id,
    expectedVersion: z.number().int().positive(),
    note: PortfolioNoteContent
  }),
  z.object({
    kind: z.literal('note.delete'),
    noteId: Id,
    expectedVersion: z.number().int().positive()
  }),
  z.object({
    kind: z.literal('note.import'),
    projectId: Id,
    entries: z.array(ImportEntry).min(1).max(200)
  }),
  z.object({ kind: z.literal('noteDraft.submit'), draft: PortfolioNoteDraftInput }),
  z.object({
    kind: z.literal('noteDraft.accept'),
    draftId: Id,
    // The note version the reviewer compared against; absent for a new note.
    expectedVersion: z.number().int().positive().optional(),
    note: PortfolioNoteContent
  }),
  z.object({ kind: z.literal('noteDraft.dismiss'), draftId: Id })
] as const
type NoteCommand = z.infer<(typeof PortfolioNoteCommands)[number]>

function projectNote(state: PortfolioState, noteId: string, expectedVersion: number) {
  const note = state.notes.find((entry) => entry.id === noteId)
  if (!note) {
    throw new Error('Note no longer exists. Refresh the initiative.')
  }
  if (note.version !== expectedVersion) {
    throw new Error('This note changed elsewhere. Reopen it to review the latest version.')
  }
  return note
}

function requireProject(state: PortfolioState, projectId: string): void {
  if (!state.projects.some((project) => project.id === projectId)) {
    throw new Error('Initiative no longer exists. Refresh and try again.')
  }
}

function write(note: PortfolioNote, content: PortfolioNoteContent, now: number): void {
  note.title = content.title
  note.body = content.body
  note.agentContext = content.agentContext
  note.version += 1
  note.updatedAt = now
}

export function applyPortfolioNoteCommand(
  state: PortfolioState,
  command: { kind: string },
  id: string,
  now: number
): boolean {
  if (!PortfolioNoteCommands.some((schema) => schema.shape.kind.value === command.kind)) {
    return false
  }
  const typed = command as NoteCommand
  const create = (projectId: string, content: PortfolioNoteContent, noteId: string) =>
    state.notes.push({
      ...content,
      id: noteId,
      projectId,
      version: 1,
      createdAt: now,
      updatedAt: now
    })
  switch (typed.kind) {
    case 'note.create':
      requireProject(state, typed.projectId)
      create(typed.projectId, typed.note, id)
      return true
    case 'note.update':
      write(projectNote(state, typed.noteId, typed.expectedVersion), typed.note, now)
      return true
    case 'note.delete': {
      projectNote(state, typed.noteId, typed.expectedVersion)
      state.notes = state.notes.filter((entry) => entry.id !== typed.noteId)
      // Keep agent proposals; they become suggestions for a new note.
      for (const draft of state.noteDrafts.filter((entry) => entry.noteId === typed.noteId)) {
        delete draft.noteId
        delete draft.baseVersion
      }
      return true
    }
    case 'note.import':
      requireProject(state, typed.projectId)
      typed.entries.forEach((entry, index) => {
        if (entry.kind === 'create') {
          create(typed.projectId, entry.note, `${id}:${index}`)
          return
        }
        const note = projectNote(state, entry.noteId, entry.expectedVersion)
        if (note.projectId !== typed.projectId) {
          throw new Error('Imported notes must belong to the selected initiative.')
        }
        write(note, entry.note, now)
      })
      return true
    case 'noteDraft.submit': {
      const { draft } = typed
      requireProject(state, draft.projectId)
      const target = draft.noteId
        ? state.notes.find((entry) => entry.id === draft.noteId)
        : undefined
      if (draft.noteId && target?.projectId !== draft.projectId) {
        throw new Error('The note to update does not exist in this initiative.')
      }
      if (
        draft.taskId &&
        !state.tasks.some((task) => task.id === draft.taskId && task.projectId === draft.projectId)
      ) {
        throw new Error('The task does not belong to this initiative.')
      }
      if (
        state.noteDrafts.filter((entry) => entry.projectId === draft.projectId).length >=
        MAX_DRAFTS_PER_PROJECT
      ) {
        throw new Error(
          'This initiative has too many pending note proposals. Ask the user to review them first.'
        )
      }
      const workItemId =
        draft.workItemId ?? state.tasks.find((task) => task.id === draft.taskId)?.workItemId
      if (
        workItemId &&
        !state.workItems.some(
          (item) => item.id === workItemId && item.projectId === draft.projectId
        )
      ) {
        throw new Error('The outcome does not belong to this initiative.')
      }
      state.noteDrafts.push({
        ...draft,
        ...(workItemId ? { workItemId } : {}),
        id,
        at: now,
        ...(target ? { baseVersion: target.version } : {})
      })
      return true
    }
    case 'noteDraft.accept': {
      const draft = state.noteDrafts.find((entry) => entry.id === typed.draftId)
      if (!draft) {
        throw new Error('This proposal was already handled. Refresh the initiative.')
      }
      if (draft.noteId) {
        if (typed.expectedVersion === undefined) {
          throw new Error('Review the current note before accepting this proposal.')
        }
        write(projectNote(state, draft.noteId, typed.expectedVersion), typed.note, now)
      } else {
        requireProject(state, draft.projectId)
        create(draft.projectId, typed.note, id)
      }
      state.noteDrafts = state.noteDrafts.filter((entry) => entry.id !== draft.id)
      return true
    }
    case 'noteDraft.dismiss':
      if (!state.noteDrafts.some((entry) => entry.id === typed.draftId)) {
        throw new Error('This proposal was already handled. Refresh the initiative.')
      }
      state.noteDrafts = state.noteDrafts.filter((entry) => entry.id !== typed.draftId)
      return true
  }
}
