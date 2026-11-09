import type * as Generation from '../text-generation/agent-generation-request'
import { randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import {
  PortfolioIntake,
  buildPortfolioIntakePrompt,
  parsePortfolioIntakeResult
} from '../../shared/portfolio-intake'
import { runGenerationRequest } from '../text-generation/agent-generation-request'
import { runLocalPlanForAgent } from '../text-generation/source-control-local-generation'
import { runPortfolioLinkedGeneration } from './portfolio-linked-generation'
import { generatePortfolioText, cancelPortfolioGeneration } from './portfolio-generation'
import { spawnSourceControlAgent } from '../text-generation/source-control-agent-launch'

vi.mock('../text-generation/agent-generation-request', async (original) => ({
  ...(await original<typeof Generation>()),
  runGenerationRequest: vi.fn()
}))
vi.mock('../text-generation/source-control-local-generation', () => ({
  runLocalPlanForAgent: vi.fn()
}))
vi.mock('../text-generation/commit-message-agent-environment', () => ({
  prepareLocalCommitMessageAgentEnv: async () => ({ ok: true, env: {} })
}))
const fields = {
  title: '',
  description: '',
  acceptanceCriteria: '',
  designReferences: '',
  sourceReference: ''
}
const request = PortfolioIntake.parse({
  requestId: randomUUID(),
  agent: 'claude',
  language: 'en',
  kind: 'improvement',
  fields,
  sources: [
    {
      url: 'https://www.figma.com/design/abc/Test?node-id=1-2',
      title: 'Figma',
      content: '',
      clipped: false
    }
  ],
  notes: ''
})

it('rejects invented or duplicate source reports and preserves the draft when no source was read', () => {
  const result = {
    fields: { ...fields, title: 'Invented' },
    questions: ['Can you grant access?'],
    sources: [{ url: request.sources[0].url, status: 'unavailable', detail: 'Login required' }]
  }
  expect(parsePortfolioIntakeResult(JSON.stringify(result), request).fields).toEqual(fields)
  expect(() =>
    parsePortfolioIntakeResult(JSON.stringify({ ...result, sources: [] }), request)
  ).toThrow('every attached source')
  expect(() =>
    parsePortfolioIntakeResult(
      JSON.stringify({ ...result, sources: [result.sources[0], result.sources[0]] }),
      request
    )
  ).toThrow()
  expect(() =>
    parsePortfolioIntakeResult(
      JSON.stringify({
        ...result,
        sources: [{ ...result.sources[0], url: 'https://example.com/other' }]
      }),
      request
    )
  ).toThrow()
  expect(buildPortfolioIntakePrompt(request)).toContain('untrusted data')
})

it('lets Claude link reading use only web and specific Figma reads, without global isolation changes', async () => {
  vi.mocked(runLocalPlanForAgent).mockResolvedValue({ success: true, rawOutput: '{}' })
  await runPortfolioLinkedGeneration({
    params: { agentId: 'claude', model: 'sonnet' },
    prompt: 'read source',
    target: { kind: 'local', cwd: '/tmp' },
    operation: 'work-item-intake',
    spawnAgent: spawnSourceControlAgent
  })
  const call = vi.mocked(runLocalPlanForAgent).mock.calls.at(-1)?.[0]
  expect(call?.plan.args).toEqual(
    expect.arrayContaining([
      '--permission-mode',
      'dontAsk',
      '--tools',
      'WebFetch',
      '--no-session-persistence'
    ])
  )
  expect(call?.plan.args).not.toContain('mcp__*')
  expect(call?.plan.args).not.toContain('--strict-mcp-config')
  expect(call?.plan.args).not.toContain('--dangerously-skip-permissions')
  expect(call?.plan.args).toContain(
    'WebFetch,mcp__figma__get_design_context,mcp__figma__get_screenshot,mcp__figma__get_metadata,mcp__figma__get_variable_defs'
  )
})

it('cancels intake in its own generation lane and discards late provider output', async () => {
  let finish!: () => void
  let ready!: () => void
  const started = new Promise<void>((resolve) => {
    ready = resolve
  })
  vi.mocked(runGenerationRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ success: true, rawOutput: 'late' })
        ready()
      })
  )
  const pending = generatePortfolioText(request, {
    owner: 'intake-test',
    operation: 'work-item-intake',
    settings: { disabledTuiAgents: [], agentCmdOverrides: {} },
    environment: undefined,
    prompt: async () => buildPortfolioIntakePrompt(request)
  })
  const rejected = expect(pending).rejects.toThrow()
  await started
  cancelPortfolioGeneration('intake-test', request.requestId)
  expect(vi.mocked(runGenerationRequest).mock.calls.at(-1)?.[0].shouldExecute?.()).toBe(false)
  expect(vi.mocked(runGenerationRequest).mock.calls.at(-1)?.[0].operation).toBe('work-item-intake')
  finish()
  await rejected
})
