import { expect, it } from 'vitest'
import {
  applyPortfolioCommand,
  emptyPortfolio,
  PortfolioCommand,
  type PortfolioState
} from './portfolio'
import { portfolioNextStep } from './portfolio-next-step'

function apply(state: PortfolioState, command: unknown, id = 'change'): void {
  applyPortfolioCommand(state, PortfolioCommand.parse(command), id, 1)
}

function fixture(): PortfolioState {
  const state = emptyPortfolio()
  apply(
    state,
    { kind: 'project.create', project: { name: 'Apps', objective: 'Ship', repoIds: [] } },
    'project'
  )
  apply(
    state,
    {
      kind: 'workItem.create',
      workItem: {
        projectId: 'project',
        kind: 'investigation',
        title: 'Scanner feels slow at the door',
        description: 'Staff report a delay after each scan',
        acceptanceCriteria: '',
        designReferences: '',
        tickets: [],
        parity: false
      }
    },
    'discovery'
  )
  return state
}

const item = (state: PortfolioState) => state.workItems[0]

it('records findings, then turns the same outcome into planned work', () => {
  const state = fixture()
  expect(portfolioNextStep(state, undefined, item(state))).toBe('discuss')
  apply(state, {
    kind: 'workItem.findings',
    workItemId: 'discovery',
    findings: 'Fact: each scan waits for a full reload.'
  })
  const conclude = {
    kind: 'workItem.conclude',
    workItemId: 'discovery',
    conclusion: { outcome: 'work', workKind: 'improvement' },
    note: 'Agreed with the user'
  }
  expect(() => apply(state, conclude)).toThrow('Write the acceptance criteria')
  const {
    id: _id,
    status: _s,
    history: _h,
    baseVersion: _b,
    designAttachments: _d,
    findings: _f,
    ...input
  } = item(state)
  apply(state, {
    kind: 'workItem.update',
    workItemId: 'discovery',
    workItem: { ...input, acceptanceCriteria: 'A scan shows the result within 300 ms' },
    expected: input
  })
  apply(state, conclude)
  expect(item(state)).toMatchObject({
    kind: 'improvement',
    status: 'planned',
    findings: 'Fact: each scan waits for a full reload.',
    conclusion: { outcome: 'work' }
  })
  expect(portfolioNextStep(state, undefined, item(state))).not.toBe('discuss')
  expect(() =>
    apply(state, { kind: 'workItem.findings', workItemId: 'discovery', findings: 'More' })
  ).toThrow('Only an open discovery outcome')
})

it('closes a discovery as a ticket or a note for later', () => {
  const ticket = fixture()
  apply(ticket, {
    kind: 'workItem.conclude',
    workItemId: 'discovery',
    conclusion: { outcome: 'ticket', reference: 'ENG-9001' },
    note: 'Not now; filed for the next quarter'
  })
  expect(item(ticket)).toMatchObject({
    kind: 'investigation',
    status: 'accepted',
    conclusion: { outcome: 'ticket', reference: 'ENG-9001' }
  })
  const note = fixture()
  const conclude = {
    kind: 'workItem.conclude',
    workItemId: 'discovery',
    conclusion: { outcome: 'note', noteId: 'scanner-note' },
    note: 'Keep for later'
  }
  expect(() => apply(note, conclude)).toThrow('Choose a note in this initiative')
  apply(
    note,
    {
      kind: 'note.create',
      projectId: 'project',
      note: { title: 'Scanner latency', body: 'Findings', agentContext: false }
    },
    'scanner-note'
  )
  apply(note, conclude)
  expect(item(note).conclusion).toMatchObject({ outcome: 'note', reference: 'scanner-note' })
})
