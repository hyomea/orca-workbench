import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import {
  commandBackslashMode,
  runGenerationRequest
} from '../text-generation/agent-generation-request'
import { runLocalPlanForAgent } from '../text-generation/source-control-local-generation'

export async function runPortfolioLinkedGeneration(
  input: Parameters<typeof runGenerationRequest>[0]
) {
  if (input.params.agentId !== 'claude' || input.target.kind !== 'local') {
    return runGenerationRequest(input)
  }
  const readTools = [
    'WebFetch',
    'mcp__figma__get_design_context',
    'mcp__figma__get_screenshot',
    'mcp__figma__get_metadata',
    'mcp__figma__get_variable_defs'
  ].join(',')
  const planned = planCommitMessageGeneration(
    {
      ...input.params,
      backslash: commandBackslashMode(input.target),
      agentArgs: `--tools WebFetch --allowedTools ${readTools} --no-session-persistence`
    },
    input.prompt,
    { strictMcp: false }
  )
  if (!planned.ok) {
    return { success: false as const, error: planned.error }
  }
  return runLocalPlanForAgent({
    agentId: input.params.agentId,
    plan: planned.plan,
    target: input.target,
    operation: input.operation,
    spawnAgent: input.spawnAgent,
    shouldExecute: input.shouldExecute
  })
}
