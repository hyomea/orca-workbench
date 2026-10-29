import { z } from 'zod'

export const JIRA_OAUTH_CALLBACK = 'http://127.0.0.1:17653/jira/oauth/callback'
export const JIRA_OAUTH_SCOPES = ['read:jira-work', 'read:jira-user', 'offline_access'] as const
export const JiraOAuthConfigure = z.object({
  clientId: z.string().trim().min(1).max(500),
  clientSecret: z.string().trim().min(1).max(4096)
})
export const JiraOAuthRequest = z.object({ requestId: z.string().uuid() })
export const JiraOAuthComplete = JiraOAuthRequest.extend({
  cloudId: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(200)
})
export const JiraOAuthResource = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(200),
  name: z.string().max(500),
  url: z.string().url().max(2000),
  scopes: z.array(z.string()).max(1000)
})
export type JiraOAuthResource = z.infer<typeof JiraOAuthResource>
export const JiraOAuthProgress = z.object({
  phase: z.enum(['waiting', 'exchanging', 'choose-site', 'connecting', 'error']),
  sites: z.array(JiraOAuthResource),
  error: z.string().optional()
})
export type JiraOAuthProgress = z.infer<typeof JiraOAuthProgress>
export const JiraOAuthConfiguration = z.object({
  configured: z.boolean(),
  clientId: z.string().optional(),
  callbackUrl: z.string(),
  protection: z.enum(['sealed', 'plaintext']).nullable()
})
export const JiraOAuthStarted = z.object({ authorizationUrl: z.string().url() })
