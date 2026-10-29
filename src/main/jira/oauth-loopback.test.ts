import { expect, it, vi } from 'vitest'
import { listenForJiraOAuth } from './oauth-loopback'

it('binds loopback, rejects a mismatched state, and accepts a single valid callback without echoing the code', async () => {
  const receive = vi.fn()
  const server = await listenForJiraOAuth(
    'http://127.0.0.1:0/jira/oauth/callback',
    'test-state',
    receive
  )
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing callback listener')
  }
  try {
    expect(address.address).toBe('127.0.0.1')
    const url = `http://127.0.0.1:${address.port}/jira/oauth/callback`
    const invalid = await fetch(`${url}?state=wrong&code=private-code`)
    expect(invalid.status).toBe(400)
    expect(receive).not.toHaveBeenCalled()
    const valid = await fetch(`${url}?state=test-state&code=private-code`)
    expect(valid.headers.get('cache-control')).toBe('no-store')
    expect(await valid.text()).not.toContain('private-code')
    expect(receive).toHaveBeenCalledExactlyOnceWith('private-code')
  } finally {
    server.closeAllConnections()
    server.close()
  }
})
