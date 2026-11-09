import { z } from 'zod'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { parseJiraConnectionStatus } from '@/runtime/jira/runtime-jira-connection-status'
import {
  getMatchingJiraSites,
  isResolvedJiraIssueMatch,
  JIRA_ISSUE_KEY_PATTERN,
  parseJiraIssueUrl
} from '../../../../shared/jira/jira-issue-url'
import type { JiraIssue, JiraSite } from '../../../../shared/jira/jira-types'

export const PortfolioJiraPreview = z.object({
  key: z.string(),
  title: z.string().max(200),
  description: z.string().max(12000),
  criteria: z.string().max(12000),
  url: z.string().max(2000),
  updatedAt: z.string(),
  clipped: z.boolean()
})
export type PortfolioJiraPreview = z.infer<typeof PortfolioJiraPreview>

export async function readPortfolioJiraSites(): Promise<JiraSite[]> {
  const status = parseJiraConnectionStatus(
    await callRuntimeRpc({ kind: 'local' }, 'jira.readStatus', undefined, { timeoutMs: 15000 })
  )
  if (status.credentialError) {
    throw new Error(status.credentialError)
  }
  return status.connected ? (status.sites ?? []) : []
}
export function portfolioJiraCandidates(value: string, sites: JiraSite[]): JiraSite[] {
  const parsed = parseJiraIssueUrl(value)
  return parsed
    ? getMatchingJiraSites(parsed, sites)
    : JIRA_ISSUE_KEY_PATTERN.test(value.trim())
      ? sites
      : []
}
export async function readPortfolioJiraTicket(
  value: string,
  site: JiraSite
): Promise<PortfolioJiraPreview> {
  const parsed = parseJiraIssueUrl(value)
  const key = parsed?.issueKey ?? value.trim().toUpperCase()
  if (!JIRA_ISSUE_KEY_PATTERN.test(key) || !portfolioJiraCandidates(value, [site]).length) {
    throw new Error('Enter a Jira ticket URL or issue key that belongs to the selected account.')
  }
  const issue = await callRuntimeRpc<JiraIssue | null>(
    { kind: 'local' },
    'jira.getIssue',
    { key, siteId: site.id, strict: true, mediaFormat: 'reference' },
    { timeoutMs: 30000 }
  )
  const requested = parsed ?? parseJiraIssueUrl(`${site.siteUrl.replace(/\/$/, '')}/browse/${key}`)
  if (!issue || !requested || !isResolvedJiraIssueMatch(requested, site, issue)) {
    throw new Error('The returned ticket does not match the selected Jira account and issue.')
  }
  return portfolioJiraPreview(issue)
}
export function portfolioJiraPreview(issue: JiraIssue): PortfolioJiraPreview {
  const description = issue.description ?? ''
  const lines = description.split('\n')
  const start = lines.findIndex((line) =>
    /^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:acceptance criteria|AC|验收标准)(?:\*\*)?\s*:?\s*$/i.test(line)
  )
  const remainder = start === -1 ? [] : lines.slice(start + 1)
  const end = remainder.findIndex((line) => /^\s*#{1,6}\s+/.test(line))
  const criteria = (end === -1 ? remainder : remainder.slice(0, end)).join('\n').trim()
  return PortfolioJiraPreview.parse({
    key: issue.key,
    title: issue.title.slice(0, 200),
    description: description.slice(0, 12000),
    criteria: criteria.slice(0, 12000),
    url: issue.url,
    updatedAt: issue.updatedAt,
    clipped: issue.title.length > 200 || description.length > 12000 || criteria.length > 12000
  })
}
export function portfolioDesignLink(value: string): { label: string; url: string } {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Use an HTTPS design link without embedded credentials.')
  }
  const host = url.hostname.toLowerCase()
  const label =
    host === 'figma.com' || host.endsWith('.figma.com')
      ? 'Figma'
      : host === 'claude.ai'
        ? 'Claude Design'
        : 'Design'
  return { label, url: url.href }
}
