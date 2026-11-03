import { z } from 'zod'
import type { PortfolioCommand, PortfolioState } from './portfolio'

const Id = z.string().trim().min(1).max(4096)
const Name = z.string().trim().min(1).max(200)
const Description = z.string().trim().min(1).max(20000)

export const PortfolioAgent = z.enum(['codex', 'claude', 'opencode'])
export const PortfolioRoleInput = z.object({
  name: Name,
  responsibility: Description,
  agent: PortfolioAgent,
  // A personal name for the role's agent, shown with the role name; the role name stays the job.
  agentName: Name.optional()
})
type PortfolioRoleInput = z.infer<typeof PortfolioRoleInput>

export function portfolioRoleLabel(role: PortfolioRoleInput): string {
  return role.agentName ? `${role.agentName} · ${role.name}` : role.name
}

export function portfolioRoleLabelById(state: PortfolioState, roleId: string): string {
  const role = state.roles.find((entry) => entry.id === roleId)
  return role ? portfolioRoleLabel(role) : ''
}

export const PortfolioRoleCommands = [
  z.object({ kind: z.literal('role.create'), role: PortfolioRoleInput }),
  z.object({
    kind: z.literal('role.update'),
    roleId: Id,
    role: PortfolioRoleInput,
    // The role as the editor last saw it, so a concurrent edit is not silently overwritten.
    expected: PortfolioRoleInput
  })
] as const

// A launch stores its prompt, so role changes reach only later launches, not retries of earlier ones.
export function applyPortfolioRoleCommand(
  state: PortfolioState,
  command: PortfolioCommand,
  id: string
): boolean {
  if (command.kind === 'role.create') {
    state.roles.push({ ...command.role, id })
    return true
  }
  if (command.kind !== 'role.update') {
    return false
  }
  const index = state.roles.findIndex((entry) => entry.id === command.roleId)
  const role = state.roles[index]
  if (!role) {
    throw new Error('Role no longer exists. Close this form and refresh.')
  }
  if (
    role.name !== command.expected.name ||
    role.responsibility !== command.expected.responsibility ||
    role.agent !== command.expected.agent ||
    role.agentName !== command.expected.agentName
  ) {
    throw new Error('Role changed. Close and reopen this form to review the latest version.')
  }
  state.roles[index] = { id: role.id, ...command.role }
  return true
}
