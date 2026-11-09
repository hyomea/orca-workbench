import { z } from 'zod'
import { JiraOAuthConfigure, JIRA_OAUTH_CALLBACK } from '../../shared/jira/jira-oauth'
import { getTokenPath, readToken, saveToken, getSiteTokenProtection } from './site-credential-store'
import { withFileTransactionLock } from '../filesystem/file-transaction-lock'
import { exchangeJiraOAuthToken } from './oauth-http'

const APP_KEY = 'oauth-app:workbench'
export const JiraOAuthGrant = z.object({
  clientId: z.string(),
  accountId: z.string(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().finite()
})
export type JiraOAuthGrant = z.infer<typeof JiraOAuthGrant>
export function readJiraOAuthApp(): z.infer<typeof JiraOAuthConfigure> {
  const raw = readToken(APP_KEY)
  if (!raw) {
    throw new Error('Set up the Atlassian OAuth application first.')
  }
  return JiraOAuthConfigure.parse(JSON.parse(raw))
}
export function jiraOAuthConfiguration() {
  const raw = readToken(APP_KEY)
  const app = raw ? JiraOAuthConfigure.parse(JSON.parse(raw)) : null
  return {
    configured: !!app,
    clientId: app?.clientId,
    callbackUrl: JIRA_OAUTH_CALLBACK,
    protection: getSiteTokenProtection(APP_KEY)
  }
}
export function configureJiraOAuthApp(input: z.infer<typeof JiraOAuthConfigure>): void {
  saveToken(APP_KEY, JSON.stringify(JiraOAuthConfigure.parse(input)))
}
export async function jiraOAuthAuthorization(grantId: string): Promise<string> {
  return withFileTransactionLock(getTokenPath(grantId), async () => {
    const raw = readToken(grantId)
    if (!raw) {
      throw new Error('Jira was disconnected. Connect with Atlassian again.')
    }
    const grant = JiraOAuthGrant.parse(JSON.parse(raw))
    if (grant.expiresAt > Date.now() + 60000) {
      return `Bearer ${grant.accessToken}`
    }
    const app = readJiraOAuthApp()
    if (app.clientId !== grant.clientId) {
      throw new Error('The Atlassian app changed. Connect with Atlassian again.')
    }
    const token = await exchangeJiraOAuthToken(app, {
      grant_type: 'refresh_token',
      refresh_token: grant.refreshToken
    })
    if (readToken(grantId) !== raw) {
      throw new Error('The Jira connection changed during renewal. Try again.')
    }
    const next: JiraOAuthGrant = {
      ...grant,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000
    }
    saveToken(grantId, JSON.stringify(next))
    return `Bearer ${next.accessToken}`
  })
}
