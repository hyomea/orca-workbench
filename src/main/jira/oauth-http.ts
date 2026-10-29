import { z } from 'zod'
import type { JiraOAuthConfigure } from '../../shared/jira/jira-oauth'
import { JiraOAuthResource } from '../../shared/jira/jira-oauth'
import { getMainHttpClient } from '../network/http-client'
import { ensureElectronProxyFromEnvironment } from '../network/proxy-settings'
import { readFetchResponseJsonWithinLimit } from '../../shared/fetch-response-body'
import { jiraGatewayBaseUrl } from './gateway-base-url'

const Token = z.object({
  access_token: z.string().min(1).max(65536),
  refresh_token: z.string().min(1).max(65536),
  expires_in: z.number().positive().max(31536000)
})
export type JiraOAuthToken = z.infer<typeof Token>
async function request(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const http = getMainHttpClient()
  const session = http.proxySession()
  await ensureElectronProxyFromEnvironment({
    ...(session ? { proxySession: session } : {}),
    probeUrl: url
  })
  const response = await http.fetch(url, {
    ...init,
    redirect: 'error',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000)
  })
  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 401
        ? 'Atlassian rejected the authorization or renewal. Check the app credentials and connect again.'
        : `Atlassian authorization request failed (HTTP ${response.status}). Try again.`
    )
  }
  return readFetchResponseJsonWithinLimit(response, 1024 * 1024)
}
export async function exchangeJiraOAuthToken(
  app: z.infer<typeof JiraOAuthConfigure>,
  fields: Record<string, string>,
  signal?: AbortSignal
): Promise<JiraOAuthToken> {
  return Token.parse(
    await request(
      'https://auth.atlassian.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          client_id: app.clientId,
          client_secret: app.clientSecret
        })
      },
      signal
    )
  )
}
export async function jiraOAuthResources(
  token: string,
  signal: AbortSignal
): Promise<JiraOAuthResource[]> {
  const sites = z
    .array(JiraOAuthResource)
    .max(1000)
    .parse(
      await request(
        'https://api.atlassian.com/oauth/token/accessible-resources',
        { headers: { Authorization: `Bearer ${token}` } },
        signal
      )
    )
  return sites.filter(
    (site) =>
      site.scopes.includes('read:jira-work') &&
      site.scopes.includes('read:jira-user') &&
      new URL(site.url).protocol === 'https:' &&
      !new URL(site.url).username &&
      !new URL(site.url).password
  )
}
export async function jiraOAuthViewer(token: string, cloudId: string, signal: AbortSignal) {
  return z
    .object({
      accountId: z.string().min(1),
      displayName: z.string().min(1),
      emailAddress: z.string().optional()
    })
    .parse(
      await request(
        `${jiraGatewayBaseUrl(cloudId)}/rest/api/3/myself`,
        { headers: { Authorization: `Bearer ${token}` } },
        signal
      )
    )
}
