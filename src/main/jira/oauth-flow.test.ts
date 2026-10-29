import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadJiraClientModule } from './__mocks__/jira-client-module'

let tempHome = ''
let receive: (code: string | null) => void = () => {}
const exchange = vi.fn()
const mocks = {
  closeAllConnectionsMock: vi.fn(),
  netFetchMock: vi.fn(),
  resolveProxyMock: vi.fn(),
  setProxyMock: vi.fn()
}
async function setup() {
  vi.doMock('./oauth-loopback', () => ({
    listenForJiraOAuth: async (_url: string, _state: string, callback: typeof receive) => {
      receive = callback
      return createServer()
    }
  }))
  vi.doMock('./oauth-http', () => ({
    exchangeJiraOAuthToken: exchange,
    jiraOAuthResources: async () => [
      {
        id: 'cloud-1',
        name: 'Team',
        url: 'https://team.atlassian.net',
        scopes: ['read:jira-work', 'read:jira-user']
      }
    ],
    jiraOAuthViewer: async () => ({
      accountId: 'user-1',
      displayName: 'Ada',
      emailAddress: 'ada@example.com'
    })
  }))
  const client = await loadJiraClientModule(mocks, tempHome)
  const credentials = await import('./oauth-credentials')
  const flow = await import('./oauth-flow')
  const store = await import('./site-credential-store')
  credentials.configureJiraOAuthApp({ clientId: 'test-app', clientSecret: 'test-secret' })
  return { client, credentials, flow, store }
}
beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'orca-jira-oauth-'))
  exchange.mockReset().mockResolvedValue({
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 3600
  })
  mocks.netFetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
  mocks.resolveProxyMock.mockResolvedValue('DIRECT')
})
afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
  vi.doUnmock('./oauth-loopback')
  vi.doUnmock('./oauth-http')
})

it('requires owner-bound state, accepts only authorized sites, and never returns tokens to the renderer', async () => {
  const { flow, client, credentials } = await setup()
  const id = randomUUID()
  try {
    const start = await flow.beginJiraOAuth('desktop:1', id)
    const url = new URL(start.authorizationUrl)
    expect(url.searchParams.get('state')?.length).toBeGreaterThan(30)
    expect(url.searchParams.get('scope')).toContain('offline_access')
    expect(JSON.stringify(start)).not.toContain('test-secret')
    expect(JSON.stringify(credentials.jiraOAuthConfiguration())).not.toContain('test-secret')
    expect(() => flow.readJiraOAuthProgress('other', id)).toThrow('another window')
    flow.cancelJiraOAuth('other', id)
    receive('test-code')
    await vi.waitFor(() =>
      expect(flow.readJiraOAuthProgress('desktop:1', id).phase).toBe('choose-site')
    )
    expect(JSON.stringify(flow.readJiraOAuthProgress('desktop:1', id))).not.toContain('test-access')
    await expect(flow.completeJiraOAuth('desktop:1', id, 'foreign-site')).rejects.toThrow(
      'Choose a Jira site'
    )
    const connected = await flow.completeJiraOAuth('desktop:1', id, 'cloud-1')
    expect(client.getStatus().sites?.[0]).toMatchObject({
      id: connected.siteId,
      accountId: 'user-1',
      apiBaseUrl: 'https://api.atlassian.com/ex/jira/cloud-1'
    })
    expect(client.getClients()[0].authorization).toBe('')
    expect(await client.getClients()[0].getAuthorization?.()).toBe('Bearer test-access')
    client.disconnect(connected.siteId)
    expect(client.getStatus().connected).toBe(false)
  } finally {
    flow.cancelJiraOAuth('desktop:1', id)
  }
})

it('discards a late exchange after cancellation without creating a connection', async () => {
  const { flow, client } = await setup()
  let finish!: () => void
  exchange.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ access_token: 'late', refresh_token: 'late-refresh', expires_in: 3600 })
      })
  )
  const id = randomUUID()
  await flow.beginJiraOAuth('owner', id)
  receive('code')
  flow.cancelJiraOAuth('owner', id)
  finish()
  await vi.waitFor(() => expect(() => flow.readJiraOAuthProgress('owner', id)).toThrow())
  expect(client.getStatus().connected).toBe(false)
})

it('rotates once for concurrent reads, sends Bearer auth through the gateway, and blocks writes', async () => {
  const { flow, client, store } = await setup()
  const id = randomUUID()
  try {
    await flow.beginJiraOAuth('owner', id)
    receive('code')
    await vi.waitFor(() =>
      expect(flow.readJiraOAuthProgress('owner', id).phase).toBe('choose-site')
    )
    await flow.completeJiraOAuth('owner', id, 'cloud-1')
    const entry = client.getClients()[0]
    const grantId = entry.site.oauthGrantId
    if (!grantId) {
      throw new Error('Missing grant')
    }
    store.saveToken(
      grantId,
      JSON.stringify({
        clientId: 'test-app',
        accountId: 'user-1',
        accessToken: 'expired',
        refreshToken: 'old-refresh',
        expiresAt: 0
      })
    )
    exchange.mockClear().mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600
    })
    const headers = await Promise.all([entry.getAuthorization?.(), entry.getAuthorization?.()])
    expect(headers).toEqual(['Bearer new-access', 'Bearer new-access'])
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(store.readToken(grantId)).toContain('new-refresh')
    await client.jiraRequest(entry, '/rest/api/3/myself')
    expect(mocks.netFetchMock).toHaveBeenLastCalledWith(
      'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/myself',
      expect.objectContaining({ redirect: 'error' })
    )
    expect(
      new Headers(mocks.netFetchMock.mock.calls.at(-1)?.[1].headers).get('Authorization')
    ).toBe('Bearer new-access')
    mocks.netFetchMock.mockResolvedValueOnce(new Response('{"issues":[]}'))
    await expect(
      client.jiraRequest(entry, '/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({ jql: 'project = MOBILE' })
      })
    ).resolves.toEqual({ issues: [] })
    await expect(
      client.jiraRequest(entry, '/rest/api/3/issue', { method: 'POST' })
    ).rejects.toThrow('read-only')
    store.saveToken(
      grantId,
      JSON.stringify({
        clientId: 'test-app',
        accountId: 'user-1',
        accessToken: 'expired',
        refreshToken: 'old-refresh',
        expiresAt: 0
      })
    )
    let finish!: () => void
    exchange.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ access_token: 'late', refresh_token: 'late-refresh', expires_in: 3600 })
        })
    )
    const renewal = entry.getAuthorization?.()
    const rejected = expect(renewal).rejects.toThrow('connection changed')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    client.disconnect()
    finish()
    await rejected
    expect(store.readToken(grantId)).toBeNull()
    await expect(entry.getAuthorization?.()).rejects.toThrow('disconnected')
  } finally {
    flow.cancelJiraOAuth('owner', id)
  }
})
