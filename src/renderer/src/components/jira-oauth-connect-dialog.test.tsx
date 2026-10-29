// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JiraOAuthConnectDialog } from './jira-oauth-connect-dialog'
import type { useJiraOAuth } from './use-jira-oauth'

const mock = vi.hoisted(() => ({ hook: vi.fn(), complete: vi.fn() }))
vi.mock('./use-jira-oauth', () => ({ useJiraOAuth: mock.hook }))
const site = {
  id: 'team',
  name: 'Team Jira',
  url: 'https://team.atlassian.net',
  scopes: ['read:jira-work']
}
beforeEach(() => {
  mock.complete.mockReset().mockResolvedValue(undefined)
  mock.hook.mockReturnValue({
    config: {
      configured: true,
      callbackUrl: 'http://127.0.0.1:17653/jira/oauth/callback',
      protection: 'sealed'
    },
    progress: { phase: 'choose-site', sites: [site] },
    pending: false,
    error: '',
    requestId: 'request',
    configure: async () => true,
    begin: async () => {},
    cancel: async () => {},
    complete: mock.complete
  } satisfies ReturnType<typeof useJiraOAuth>)
})
afterEach(cleanup)

it('selects the only authorized site but waits for confirmation before connecting', () => {
  render(<JiraOAuthConnectDialog open onOpenChange={vi.fn()} onTokenMode={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Finish connecting Jira' })).toBeTruthy()
  expect(screen.getByText(/Your Jira site is selected below/)).toBeTruthy()
  expect(mock.complete).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'Connect selected site' })
  expect(button).toHaveProperty('disabled', false)
  fireEvent.click(button)
  expect(mock.complete).toHaveBeenCalledExactlyOnceWith('team')
})

it('requires a choice when more than one Jira site is authorized', () => {
  const flow: ReturnType<typeof useJiraOAuth> = mock.hook()
  mock.hook.mockReturnValue({
    ...flow,
    progress: {
      phase: 'choose-site',
      sites: [site, { ...site, id: 'another', name: 'Another team' }]
    }
  })
  render(<JiraOAuthConnectDialog open onOpenChange={vi.fn()} onTokenMode={vi.fn()} />)
  expect(screen.getByText(/Choose a Jira site below/)).toBeTruthy()
  const button = screen.getByRole('button', { name: 'Connect selected site' })
  expect(button).toHaveProperty('disabled', true)
  fireEvent.click(button)
  expect(mock.complete).not.toHaveBeenCalled()
})
