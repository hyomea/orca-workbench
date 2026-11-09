import { expect, it, vi } from 'vitest'
import type { JiraIssue, JiraSite } from '../../../../shared/jira/jira-types'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import {
  portfolioDesignLink,
  portfolioJiraCandidates,
  portfolioJiraPreview,
  readPortfolioJiraTicket
} from './portfolio-context-sources'
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: vi.fn() }))
const site: JiraSite = {
  id: 'site',
  siteUrl: 'https://team.atlassian.net',
  email: 'user@example.com',
  displayName: 'Team',
  accountId: 'account'
}
const issue: JiraIssue = {
  id: '1',
  key: 'APP-1',
  siteId: 'site',
  title: 'Report counts',
  description:
    '# Problem\nWrong count\n## Acceptance criteria\n- Show sold and remaining\n## Design\nUse native controls',
  url: 'https://team.atlassian.net/browse/APP-1',
  project: { id: 'p', name: 'App', key: 'APP' },
  issueType: { id: 'story', name: 'Story' },
  status: { id: 'open', name: 'Open', categoryKey: 'new', categoryName: 'New', colorName: 'blue' },
  labels: [],
  updatedAt: '2026-10-29',
  createdAt: '2026-10-28'
}

it('binds Jira imports to the connected site and validates the returned identity', async () => {
  expect(portfolioJiraCandidates('https://other.atlassian.net/browse/APP-1', [site])).toEqual([])
  vi.mocked(callRuntimeRpc).mockResolvedValue(issue)
  await expect(readPortfolioJiraTicket('APP-1', site)).resolves.toMatchObject({
    title: issue.title,
    criteria: '- Show sold and remaining'
  })
  expect(callRuntimeRpc).toHaveBeenCalledWith(
    { kind: 'local' },
    'jira.getIssue',
    { key: 'APP-1', siteId: 'site', strict: true, mediaFormat: 'reference' },
    { timeoutMs: 30000 }
  )
  vi.mocked(callRuntimeRpc).mockResolvedValue({ ...issue, siteId: 'other-account' })
  await expect(readPortfolioJiraTicket('APP-1', site)).rejects.toThrow('does not match')
  await expect(
    readPortfolioJiraTicket('https://other.atlassian.net/browse/APP-1', site)
  ).rejects.toThrow('selected account')
})
it('extracts only explicitly labeled AC and marks bounded imports as shortened', () => {
  expect(portfolioJiraPreview(issue).criteria).toBe('- Show sold and remaining')
  expect(
    portfolioJiraPreview({ ...issue, description: 'User wants faster reports' }).criteria
  ).toBe('')
  const preview = portfolioJiraPreview({ ...issue, description: 'x'.repeat(12001) })
  expect(preview.clipped).toBe(true)
  expect(preview.description).toHaveLength(12000)
})
it('keeps Figma node identifiers and attaches design links without fetching them', () => {
  const link = 'https://www.figma.com/design/file/Report?node-id=1-2'
  expect(portfolioDesignLink(link)).toEqual({ label: 'Figma', url: link })
  expect(portfolioDesignLink('https://claude.ai/design/example').label).toBe('Claude Design')
  expect(() => portfolioDesignLink('javascript:alert(1)')).toThrow('HTTPS')
  expect(() => portfolioDesignLink('https://user:secret@figma.com/design/a')).toThrow('credentials')
  expect(portfolioDesignLink('https://figma.com.example.org/design/a').label).toBe('Design')
})
