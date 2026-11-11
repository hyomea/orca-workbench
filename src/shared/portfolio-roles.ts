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
  agentName: Name.optional(),
  // The outcome coordinator: once the workbench coordinator hands an outcome over, it keeps that
  // outcome's checklist and plan and delegates its tasks. It never takes a task itself. Set when
  // the role is created; absent means a working role.
  coordinator: z.literal(true).optional()
})
type PortfolioRoleInput = z.infer<typeof PortfolioRoleInput>

// Every new workbench starts with this role. It is not the workbench coordinator (the steward),
// which shapes the initiative and its outcomes and hands each one over when it is ready to plan.
export const PORTFOLIO_OUTCOME_COORDINATOR: PortfolioRoleInput = {
  name: 'Outcome coordinator',
  agent: 'claude',
  coordinator: true,
  responsibility:
    'Coordinates one outcome after the workbench coordinator hands it over: keeps its checklist and context current from the inbox and the working agents’ reports, plans its tasks by platform and stage, and asks the user before starting any agent. Does not write code or take a task, and leaves other outcomes and the initiative to the workbench coordinator.'
}

// The roles a task can be assigned to.
export function portfolioWorkingRoles(state: PortfolioState): PortfolioState['roles'] {
  return state.roles.filter((role) => !role.coordinator)
}

export function assertPortfolioWorkingRole(state: PortfolioState, roleId: string): void {
  const role = state.roles.find((entry) => entry.id === roleId)
  if (!role) {
    throw new Error('Choose an existing role.')
  }
  if (role.coordinator) {
    throw new Error(
      'The outcome coordinator plans and delegates; assign the task to a working role.'
    )
  }
}

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
  // Whether a role coordinates is fixed when it is created.
  const { coordinator: _coordinator, ...details } = command.role
  state.roles[index] = {
    id: role.id,
    ...details,
    ...(role.coordinator ? { coordinator: true } : {})
  }
  return true
}
