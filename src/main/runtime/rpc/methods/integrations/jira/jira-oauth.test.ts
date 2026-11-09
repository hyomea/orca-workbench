import '../../../unused-default-rpc-methods.test-fixture'
import { expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { eraseRpcMethods, type RpcContext } from '../../../core'
import { JIRA_OAUTH_METHODS } from './jira-oauth'

const mocks = vi.hoisted(() => ({
  configuration: vi.fn(() => ({ configured: false })),
  begin: vi.fn()
}))
vi.mock('../../../../../jira/oauth-credentials', () => ({
  configureJiraOAuthApp: vi.fn(),
  jiraOAuthConfiguration: mocks.configuration
}))
vi.mock('../../../../../jira/oauth-flow', () => ({
  beginJiraOAuth: mocks.begin,
  cancelJiraOAuth: vi.fn(),
  readJiraOAuthProgress: vi.fn(),
  completeJiraOAuth: vi.fn()
}))

it('allows only the local desktop to configure or begin browser authorization', () => {
  const runtime = new OrcaRuntimeService(null)
  const methods = eraseRpcMethods(JIRA_OAUTH_METHODS)
  const remote: RpcContext[] = [
    { runtime },
    { runtime, caller: { kind: 'local-cli' } },
    { runtime, caller: { kind: 'paired-device', deviceId: 'remote' } },
    { runtime, caller: { kind: 'desktop' }, pairedDeviceId: 'remote' }
  ]
  for (const method of methods) {
    expect(method.permission).toBe('accounts-admin')
    for (const context of remote) {
      expect(() => method.handler({ requestId: 'request' }, context)).toThrow('local desktop')
    }
  }
  expect(mocks.configuration).not.toHaveBeenCalled()
  expect(mocks.begin).not.toHaveBeenCalled()
  const context: RpcContext = { runtime, caller: { kind: 'desktop' }, connectionId: 'window-1' }
  methods.find((method) => method.name === 'jira.oauthConfiguration')?.handler(undefined, context)
  methods
    .find((method) => method.name === 'jira.oauthBegin')
    ?.handler({ requestId: 'request' }, context)
  expect(mocks.configuration).toHaveBeenCalledOnce()
  expect(mocks.begin).toHaveBeenCalledWith('desktop:window-1', 'request')
})
