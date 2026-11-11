import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  parsePortfolioState,
  PortfolioCommand,
  preparePortfolioAttempt,
  type PortfolioState
} from './portfolio'
import { PortfolioWorkItemInput } from './portfolio-features'
import { portfolioChecklist, portfolioChecklistText } from './portfolio-checklist'

function apply(state: PortfolioState, command: unknown, id = 'change', now = 1): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, now)
}

const OUTCOME = {
  projectId: 'project',
  kind: 'engineering',
  title: 'Upload signatures',
  description: 'Through the API',
  acceptanceCriteria: '- A signed sale shows the signature\n\n* 401 still logs out\n',
  designReferences: '',
  tickets: [{ platform: 'android', reference: 'ENG-8339' }],
  parity: false
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: ['r'] } },
    'project'
  )
  apply(
    state,
    { kind: 'role.create', role: { name: 'Engineer', agent: 'claude', responsibility: 'Build' } },
    'role'
  )
  apply(state, { kind: 'workItem.create', workItem: OUTCOME }, 'outcome')
  apply(
    state,
    {
      kind: 'task.create',
      task: {
        projectId: 'project',
        workItemId: 'outcome',
        roleId: 'role',
        platform: 'android',
        title: 'Android development',
        instructions: 'Build it',
        acceptanceCriteria: 'Done'
      }
    },
    'development'
  )
  return state
}

it('reads an outcome saved before checklists as criteria items, one per line', () => {
  const state = parsePortfolioState(JSON.parse(JSON.stringify(fixture())))
  const item = state.workItems[0]
  expect(item.checklist).toBeUndefined()
  expect(portfolioChecklist(item).map((entry) => [entry.kind, entry.text])).toEqual([
    ['criterion', 'A signed sale shows the signature'],
    ['criterion', '401 still logs out']
  ])
})

it('records a decision while the work runs, and the next task prompt carries it', () => {
  const state = fixture()
  preparePortfolioAttempt(state, 'development', 'w', 'r', 'op', 2).state = 'launched'
  const [first, second] = portfolioChecklist(state.workItems[0])
  // Editing the outcome itself is closed while a task runs; the checklist is not.
  expect(() =>
    apply(state, {
      kind: 'workItem.update',
      workItemId: 'outcome',
      workItem: OUTCOME,
      expected: PortfolioWorkItemInput.parse(state.workItems[0])
    })
  ).toThrow('Only planned work items')
  apply(
    state,
    {
      kind: 'workItem.checklist',
      workItemId: 'outcome',
      items: [
        { id: first.id, kind: 'criterion', text: first.text },
        { id: second.id, kind: 'criterion', text: second.text },
        {
          kind: 'decision',
          text: 'No retry on a failed upload; the sale completes without the signature',
          note: 'Agreed with Kiki for both platforms'
        }
      ]
    },
    'checklist',
    5
  )
  const item = state.workItems[0]
  expect(item.checklist?.[0]).toEqual(first)
  expect(item.checklist?.[2]).toMatchObject({ kind: 'decision', at: 5 })
  // The criteria text stays the criteria; the decision reaches agents through the checklist.
  expect(item.acceptanceCriteria).toBe('- A signed sale shows the signature\n- 401 still logs out')
  expect(portfolioChecklistText(item)).toContain(
    'Decisions:\n- No retry on a failed upload; the sale completes without the signature (Agreed with Kiki for both platforms)'
  )
  expect(item.history.at(-1)?.note).toBe('Checklist updated')
  apply(state, { kind: 'task.closeExecution', taskId: 'development', note: 'Restart' })
  expect(preparePortfolioAttempt(state, 'development', 'w', 'r', 'op2', 6).prompt).toContain(
    'No retry on a failed upload'
  )
})

it('keeps decisions and unchanged criteria when the outcome’s criteria are edited', () => {
  const state = fixture()
  // Editing the outcome needs its tasks finished; this one has none.
  apply(state, { kind: 'task.delete', taskId: 'development' })
  apply(state, {
    kind: 'workItem.checklist',
    workItemId: 'outcome',
    items: [
      ...portfolioChecklist(state.workItems[0]),
      { kind: 'decision', text: 'Use the shared API client' }
    ]
  })
  const kept = state.workItems[0].checklist?.[0]
  apply(
    state,
    {
      kind: 'workItem.update',
      workItemId: 'outcome',
      workItem: { ...OUTCOME, acceptanceCriteria: `- ${kept?.text}\n- Errors never hang` },
      expected: PortfolioWorkItemInput.parse(state.workItems[0])
    },
    'update',
    9
  )
  expect(state.workItems[0].checklist?.map((entry) => [entry.kind, entry.text])).toEqual([
    ['criterion', 'A signed sale shows the signature'],
    ['criterion', 'Errors never hang'],
    ['decision', 'Use the shared API client']
  ])
  expect(state.workItems[0].checklist?.[0]).toEqual(kept)
})

it('closes the checklist once the outcome is signed off', () => {
  const state = fixture()
  apply(state, { kind: 'task.delete', taskId: 'development' })
  apply(state, {
    kind: 'workItem.transition',
    workItemId: 'outcome',
    status: 'accepted',
    note: 'Done'
  })
  expect(() =>
    apply(state, { kind: 'workItem.checklist', workItemId: 'outcome', items: [] })
  ).toThrow('Reopen the outcome before changing its checklist.')
})
