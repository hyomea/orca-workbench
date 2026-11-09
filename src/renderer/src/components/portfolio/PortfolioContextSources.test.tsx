// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { readPortfolioIntake, cancelPortfolioIntake } from './portfolio-intake-actions'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import type * as Sources from './portfolio-context-sources'
import { PortfolioFeatureComposer } from './PortfolioFeatureComposer'
import { readPortfolioJiraSites, readPortfolioJiraTicket } from './portfolio-context-sources'
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback,
  getIntlLocale: () => 'en'
}))
vi.mock('./portfolio-context-sources', async (original) => ({
  ...(await original<typeof Sources>()),
  readPortfolioJiraSites: vi.fn(),
  readPortfolioJiraTicket: vi.fn()
}))
vi.mock('./portfolio-intake-actions', () => ({
  readPortfolioIntake: vi.fn(),
  cancelPortfolioIntake: vi.fn(async () => {})
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}
function enter(name: string, value: string) {
  fireEvent.change(screen.getByLabelText(name), { target: { value } })
}
function props() {
  return {
    mode: 'outcome' as const,
    projectId: 'p',
    featureId: 'f',
    draftKey: createBrowserUuid(),
    busy: false,
    saveError: '',
    onSave: vi.fn(async () => true),
    onClose: vi.fn()
  }
}

const fields = {
  title: 'Report counts',
  description: 'Consistent counters',
  acceptanceCriteria: 'Show 5 sold',
  designReferences: '',
  sourceReference: 'https://team.atlassian.net/browse/APP-1'
}
const result = {
  fields,
  questions: [],
  sources: [{ url: fields.sourceReference, status: 'read' as const, detail: 'Consistent counters' }]
}
function mockTicket() {
  vi.mocked(readPortfolioJiraSites).mockResolvedValue([
    {
      id: 'site',
      siteUrl: 'https://team.atlassian.net',
      email: '',
      displayName: 'Team',
      accountId: 'a'
    }
  ])
  vi.mocked(readPortfolioJiraTicket).mockResolvedValue({
    key: 'APP-1',
    title: 'Report counts',
    description: 'Consistent counters',
    criteria: 'Show 5 sold',
    url: fields.sourceReference,
    updatedAt: '2026-10-29',
    clipped: false
  })
}
it('reads and fills the draft in one action, keeps edits and retains the result after closing', async () => {
  mockTicket()
  vi.mocked(readPortfolioIntake).mockResolvedValue(result)
  const options = props()
  const first = render(<PortfolioFeatureComposer {...options} />)
  enter('Name', 'My draft')
  await click('Jira ticket')
  enter('Ticket URL or issue key', 'APP-1')
  await click('Read and fill draft')
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'My draft')
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty('value', 'Show 5 sold')
  expect(screen.queryByRole('button', { name: 'Use ticket content' })).toBeNull()
  expect(readPortfolioIntake).toHaveBeenCalledWith(
    expect.objectContaining({
      sources: [expect.objectContaining({ content: 'Consistent counters' })]
    })
  )
  await click('Close and keep draft')
  first.unmount()
  render(<PortfolioFeatureComposer {...options} />)
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty('value', 'Show 5 sold')
  expect(screen.getByText('Source access report')).toBeTruthy()
  await click('Confirm and save')
  expect(options.onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      workItem: expect.objectContaining({ title: 'My draft', acceptanceCriteria: 'Show 5 sold' })
    })
  )
})
it('retains design notes and links when access fails instead of inventing requirements', async () => {
  vi.mocked(readPortfolioIntake).mockResolvedValue({
    fields: {
      ...fields,
      title: 'Reports',
      acceptanceCriteria: '',
      description: '',
      sourceReference: ''
    },
    questions: ['Please grant Figma access.'],
    sources: [
      {
        url: 'https://www.figma.com/design/abc/Report?node-id=1-2',
        status: 'unavailable',
        detail: 'No MCP access'
      }
    ]
  })
  const options = props()
  render(<PortfolioFeatureComposer {...options} />)
  enter('Name', 'Reports')
  enter('Design references and notes', 'Use native controls')
  await click('Design link')
  enter('Figma or Claude Design link', 'https://www.figma.com/design/abc/Report?node-id=1-2')
  await click('Read and fill draft')
  expect(screen.getByLabelText('Design references and notes')).toHaveProperty(
    'value',
    'Use native controls\n\nFigma: https://www.figma.com/design/abc/Report?node-id=1-2'
  )
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty('value', '')
  expect(screen.getByText('Please grant Figma access.')).toBeTruthy()
})
it('keeps draft inputs after an agent failure and ignores results after stopping', async () => {
  mockTicket()
  vi.mocked(readPortfolioIntake).mockRejectedValueOnce(new Error('Agent unavailable'))
  render(<PortfolioFeatureComposer {...props()} />)
  await click('Jira ticket')
  enter('Ticket URL or issue key', 'APP-1')
  await click('Read and fill draft')
  expect(screen.getByRole('alert').textContent).toBe('Agent unavailable')
  let finish!: () => void
  vi.mocked(readPortfolioIntake).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(result)
      })
  )
  await click('Refine draft with AI')
  expect(screen.getByLabelText('Name').closest('fieldset')).toHaveProperty('disabled', true)
  await click('Stop analysis')
  expect(cancelPortfolioIntake).toHaveBeenCalled()
  await act(async () => finish())
  expect(screen.getByLabelText('Name')).toHaveProperty('value', '')
})

it('fills design notes on a new draft and preserves an intentional field clearing during refinement', async () => {
  const url = 'https://www.figma.com/design/abc/Report'
  const designResult = {
    ...result,
    fields: { ...fields, designReferences: `Show both counters side by side. ${url}` },
    sources: [{ url, status: 'read' as const, detail: 'Sold and remaining counters' }]
  }
  vi.mocked(readPortfolioIntake).mockResolvedValue(designResult)
  render(<PortfolioFeatureComposer {...props()} />)
  await click('Design link')
  enter('Figma or Claude Design link', url)
  await click('Read and fill draft')
  expect(screen.getByLabelText('Design references and notes')).toHaveProperty(
    'value',
    designResult.fields.designReferences
  )
  enter('Acceptance criteria', '')
  await click('Refine draft with AI')
  expect(screen.getByLabelText('Acceptance criteria')).toHaveProperty('value', '')
})

it('retains an unread design URL in the request and draft even when the form started empty', async () => {
  vi.mocked(readPortfolioIntake).mockImplementation(async (request) => ({
    fields: request.fields,
    questions: ['Share a readable design.'],
    sources: request.sources.map((source) => ({
      url: source.url,
      status: 'unavailable',
      detail: 'Sign-in required'
    }))
  }))
  render(<PortfolioFeatureComposer {...props()} />)
  const url = 'https://claude.ai/design/example'
  await click('Design link')
  enter('Figma or Claude Design link', url)
  await click('Read and fill draft')
  expect(screen.getByLabelText('Design references and notes')).toHaveProperty(
    'value',
    `Claude Design: ${url}`
  )
  expect(screen.getByLabelText('Name')).toHaveProperty('value', '')
})
