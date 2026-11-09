// @vitest-environment happy-dom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  type PortfolioCommand
} from '../../../../shared/portfolio'
import { portfolioNoteMarkdown } from '../../../../shared/portfolio-note-markdown'
import { PortfolioNotes } from './PortfolioNotes'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? ''))
}))
afterEach(cleanup)

function harness() {
  const commands: PortfolioCommand[] = []
  const initial = emptyPortfolio()
  initial.projects.push({ id: 'p', name: 'Ludus', objective: 'Parity', repoIds: [] })
  applyPortfolioCommand(
    initial,
    {
      kind: 'note.create',
      projectId: 'p',
      note: { title: 'Setup', body: 'old', agentContext: true }
    },
    'setup',
    1
  )
  applyPortfolioCommand(
    initial,
    {
      kind: 'noteDraft.submit',
      draft: {
        projectId: 'p',
        noteId: 'setup',
        title: 'Setup',
        body: 'proposed',
        reason: 'Verified'
      }
    },
    'draft',
    2
  )
  function App() {
    const [state, setState] = useState(initial)
    return (
      <PortfolioNotes
        state={state}
        projectId="p"
        busy={false}
        onExport={async () => null}
        onSave={async (command) => {
          commands.push(command)
          const next = structuredClone(state)
          applyPortfolioCommand(next, command, createBrowserUuid(), Date.now())
          setState(next)
          return true
        }}
      />
    )
  }
  render(<App />)
  return { commands }
}

async function click(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

it('accepts an agent proposal only through review', async () => {
  const { commands } = harness()
  await click('Setup Update')
  expect(screen.getByText('Verified')).toBeTruthy()
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: 'reviewed' } })
  })
  await click('Accept proposal')
  expect(commands).toEqual([
    {
      kind: 'noteDraft.accept',
      draftId: 'draft',
      expectedVersion: 1,
      note: { title: 'Setup', body: 'reviewed', agentContext: true }
    }
  ])
  expect(screen.queryByText(/Agent proposals/)).toBeNull()
})

it('imports new notes by default and replaces existing ones only when chosen', async () => {
  const { commands } = harness()
  const files = [
    new File(['# Setup\nnew steps'], 'setup.md'),
    new File(
      [
        portfolioNoteMarkdown({
          id: 'x',
          title: 'ADB',
          body: 'adb',
          agentContext: false,
          updatedAt: 0
        })
      ],
      'adb.md'
    )
  ]
  const input = document.querySelector('input[type="file"]')
  if (!input) {
    throw new Error('File input missing')
  }
  await act(async () => {
    fireEvent.change(input, { target: { files } })
  })
  expect(screen.getByText('Replaces existing')).toBeTruthy()
  await click('Import 1 selected')
  expect(commands.at(-1)).toEqual({
    kind: 'note.import',
    projectId: 'p',
    entries: [{ kind: 'create', note: { title: 'ADB', body: 'adb', agentContext: false } }]
  })
  expect(screen.getByRole('button', { name: /ADB/ })).toBeTruthy()
})
