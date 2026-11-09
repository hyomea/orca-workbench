// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useJiraOAuth } from './use-jira-oauth'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: rpc }))
const config = {
  configured: true,
  clientId: 'app',
  callbackUrl: 'http://127.0.0.1:17653/jira/oauth/callback',
  protection: 'sealed'
}
beforeEach(() => {
  rpc.mockReset().mockImplementation(async (_target, method) => {
    if (method === 'jira.oauthConfiguration') {
      return config
    }
    if (method === 'jira.oauthBegin') {
      return { authorizationUrl: 'https://auth.atlassian.com/authorize?state=test' }
    }
    if (method === 'jira.oauthProgress') {
      return {
        phase: 'choose-site',
        sites: [
          {
            id: 'site',
            name: 'Team',
            url: 'https://team.atlassian.net',
            scopes: ['read:jira-work']
          }
        ]
      }
    }
    if (method === 'jira.oauthComplete') {
      return { ok: true, siteId: 'site' }
    }
    return { ok: true }
  })
  vi.stubGlobal('api', undefined)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { shell: { openUrl: vi.fn().mockResolvedValue(undefined) } }
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('opens browser authorization, chooses an authorized site, and reports successful completion', async () => {
  const connected = vi.fn()
  const { result } = renderHook(() => useJiraOAuth(connected))
  await waitFor(() => expect(result.current.config?.configured).toBe(true))
  await act(() => result.current.begin())
  expect(window.api.shell.openUrl).toHaveBeenCalledWith(
    'https://auth.atlassian.com/authorize?state=test'
  )
  await waitFor(() => expect(result.current.progress?.phase).toBe('choose-site'))
  await act(() => result.current.complete('site'))
  expect(connected).toHaveBeenCalledOnce()
  expect(result.current.requestId).toBe('')
})

it('cancels a late begin response after closing without opening a browser', async () => {
  let finish!: (value: unknown) => void
  rpc.mockImplementation(async (_target, method) => {
    if (method === 'jira.oauthConfiguration') {
      return config
    }
    if (method === 'jira.oauthBegin') {
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    return { ok: true }
  })
  const { result, unmount } = renderHook(() => useJiraOAuth(vi.fn()))
  await waitFor(() => expect(result.current.config).toBeTruthy())
  let pending!: Promise<void>
  act(() => {
    pending = result.current.begin()
  })
  unmount()
  finish({ authorizationUrl: 'https://auth.atlassian.com/authorize' })
  await pending
  expect(window.api.shell.openUrl).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledWith(
    { kind: 'local' },
    'jira.oauthCancel',
    expect.objectContaining({ requestId: expect.any(String) }),
    expect.anything()
  )
})

it('retains setup on a save failure and rejects an unexpected browser destination', async () => {
  const { result } = renderHook(() => useJiraOAuth(vi.fn()))
  await waitFor(() => expect(result.current.config).toBeTruthy())
  rpc.mockRejectedValueOnce(new Error('Cannot save credentials'))
  await act(async () => {
    expect(await result.current.configure('app', 'secret')).toBe(false)
  })
  expect(result.current.error).toBe('Cannot save credentials')
  rpc.mockResolvedValueOnce({ authorizationUrl: 'https://unexpected.example/authorize' })
  await act(() => result.current.begin())
  expect(window.api.shell.openUrl).not.toHaveBeenCalled()
  expect(result.current.error).toBe('Invalid Atlassian authorization URL.')
})
