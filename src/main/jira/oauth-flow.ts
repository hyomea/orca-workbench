import { createHash, randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import {
  JIRA_OAUTH_CALLBACK,
  JIRA_OAUTH_SCOPES,
  type JiraOAuthProgress
} from '../../shared/jira/jira-oauth'
import { readJiraOAuthApp, type JiraOAuthGrant } from './oauth-credentials'
import {
  exchangeJiraOAuthToken,
  jiraOAuthResources,
  jiraOAuthViewer,
  type JiraOAuthToken
} from './oauth-http'
import { listenForJiraOAuth } from './oauth-loopback'
import { getSiteFile, saveToken, writeSiteFile, getTokenPath } from './site-credential-store'
import { getSiteId, normalizeJiraSiteUrl } from './site-identity'
import { jiraGatewayBaseUrl } from './gateway-base-url'
import { clearAttachmentImagesForSite } from './attachments/image-cache'
import { withFileTransactionLock } from '../filesystem/file-transaction-lock'

type Flow = {
  owner: string
  controller: AbortController
  state: string
  server?: Server
  timer: ReturnType<typeof setTimeout>
  app: ReturnType<typeof readJiraOAuthApp>
  progress: JiraOAuthProgress
  token?: JiraOAuthToken
  tokenExpiresAt?: number
}
const flows = new Map<string, Flow>()
function owned(owner: string, requestId: string): Flow {
  const flow = flows.get(requestId)
  if (!flow || flow.owner !== owner) {
    throw new Error('This Jira sign-in expired or belongs to another window. Start again.')
  }
  return flow
}
export function cancelJiraOAuth(owner: string, requestId: string): void {
  const flow = flows.get(requestId)
  if (!flow || flow.owner !== owner) {
    return
  }
  flow.controller.abort()
  flow.server?.close()
  flow.server?.closeAllConnections()
  clearTimeout(flow.timer)
  flows.delete(requestId)
}
export function readJiraOAuthProgress(owner: string, requestId: string): JiraOAuthProgress {
  return owned(owner, requestId).progress
}
export async function beginJiraOAuth(owner: string, requestId: string) {
  if (flows.size) {
    throw new Error('Another Jira browser sign-in is running. Finish or cancel it first.')
  }
  const app = readJiraOAuthApp()
  const flow: Flow = {
    owner,
    app,
    state: randomBytes(32).toString('base64url'),
    controller: new AbortController(),
    progress: { phase: 'waiting', sites: [] },
    timer: setTimeout(() => cancelJiraOAuth(owner, requestId), 300000)
  }
  flows.set(requestId, flow)
  try {
    flow.server = await listenForJiraOAuth(JIRA_OAUTH_CALLBACK, flow.state, (code) => {
      void receive(flow, code)
    })
    if (flow.controller.signal.aborted) {
      flow.server.close()
      throw new Error('Jira sign-in canceled.')
    }
    const url = new URL('https://auth.atlassian.com/authorize')
    for (const [key, value] of Object.entries({
      audience: 'api.atlassian.com',
      client_id: app.clientId,
      scope: JIRA_OAUTH_SCOPES.join(' '),
      redirect_uri: JIRA_OAUTH_CALLBACK,
      state: flow.state,
      response_type: 'code',
      prompt: 'consent'
    })) {
      url.searchParams.set(key, value)
    }
    return { authorizationUrl: url.href }
  } catch {
    cancelJiraOAuth(owner, requestId)
    throw new Error(
      'Could not start Jira browser sign-in. Check that local port 17653 is available and try again.'
    )
  }
}
async function receive(flow: Flow, code: string | null): Promise<void> {
  if (flow.progress.phase !== 'waiting' || flow.controller.signal.aborted) {
    return
  }
  flow.progress = { phase: 'exchanging', sites: [] }
  try {
    if (!code) {
      throw new Error('Atlassian authorization was not granted. You can try again.')
    }
    const token = await exchangeJiraOAuthToken(
      flow.app,
      { grant_type: 'authorization_code', code, redirect_uri: JIRA_OAUTH_CALLBACK },
      flow.controller.signal
    )
    flow.tokenExpiresAt = Date.now() + token.expires_in * 1000
    const sites = await jiraOAuthResources(token.access_token, flow.controller.signal)
    flow.controller.signal.throwIfAborted()
    if (!sites.length) {
      throw new Error(
        'No Jira sites were authorized with the required read permissions. Check the application scopes and your site access.'
      )
    }
    flow.token = token
    flow.progress = { phase: 'choose-site', sites }
  } catch (error) {
    flow.progress = {
      phase: 'error',
      sites: [],
      error: error instanceof Error ? error.message : 'Jira authorization failed.'
    }
  }
}
export async function completeJiraOAuth(owner: string, requestId: string, cloudId: string) {
  const flow = owned(owner, requestId)
  const resource = flow.progress.sites.find((site) => site.id === cloudId)
  if (flow.progress.phase !== 'choose-site' || !resource || !flow.token) {
    throw new Error('Choose a Jira site returned by this authorization.')
  }
  const sites = flow.progress.sites
  flow.progress = { phase: 'connecting', sites }
  try {
    const token = flow.token
    const viewer = await jiraOAuthViewer(token.access_token, cloudId, flow.controller.signal)
    const grantId = `oauth-grant:${createHash('sha256').update(`${flow.app.clientId}\n${viewer.accountId}\n${cloudId}`).digest('base64url')}`
    const siteUrl = normalizeJiraSiteUrl(resource.url)
    const siteId = getSiteId(siteUrl, viewer.emailAddress || viewer.accountId)
    const grant: JiraOAuthGrant = {
      clientId: flow.app.clientId,
      accountId: viewer.accountId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: flow.tokenExpiresAt ?? Date.now()
    }
    await withFileTransactionLock(getTokenPath(grantId), async () => {
      flow.controller.signal.throwIfAborted()
      saveToken(grantId, JSON.stringify(grant))
      const file = getSiteFile()
      const site = {
        id: siteId,
        siteUrl,
        email: viewer.emailAddress ?? '',
        displayName: viewer.displayName,
        accountId: viewer.accountId,
        authType: 'cloud' as const,
        apiBaseUrl: jiraGatewayBaseUrl(cloudId),
        oauthGrantId: grantId
      }
      writeSiteFile({
        version: 1,
        activeSiteId: siteId,
        selectedSiteId: siteId,
        sites: [site, ...file.sites.filter((entry) => entry.id !== siteId)]
      })
      clearAttachmentImagesForSite(siteId)
    })
    cancelJiraOAuth(owner, requestId)
    return { ok: true, siteId }
  } catch (error) {
    if (!flow.controller.signal.aborted) {
      flow.progress = { phase: 'choose-site', sites }
    }
    throw error
  }
}
