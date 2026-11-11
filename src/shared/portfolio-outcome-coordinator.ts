import { z } from 'zod'
import type { PortfolioState } from './portfolio'
import { portfolioRoleLabel } from './portfolio-roles'

const Id = z.string().trim().min(1).max(4096)

// An outcome handed over to its own coordinator: the workbench coordinator (the steward) leaves
// it alone until the user hands it back. Its session runs in its own folder.
export const PortfolioOutcomeCoordinator = z.object({
  roleId: Id,
  path: z.string().min(1).max(4096),
  at: z.number()
})
export type PortfolioOutcomeCoordinator = z.infer<typeof PortfolioOutcomeCoordinator>

export const PortfolioOutcomeCoordinatorCommands = [
  z.object({
    kind: z.literal('workItem.handOff'),
    workItemId: Id,
    roleId: Id,
    path: PortfolioOutcomeCoordinator.shape.path
  }),
  z.object({ kind: z.literal('workItem.handBack'), workItemId: Id })
] as const
type CoordinatorCommand = z.infer<(typeof PortfolioOutcomeCoordinatorCommands)[number]>

// The role that coordinates outcomes in this workbench, if it has one.
export function portfolioCoordinatorRole(
  state: PortfolioState
): PortfolioState['roles'][number] | undefined {
  return state.roles.find((role) => role.coordinator)
}

export function applyPortfolioOutcomeCoordinatorCommand(
  state: PortfolioState,
  command: { kind: string },
  now: number
): boolean {
  if (
    !PortfolioOutcomeCoordinatorCommands.some((schema) => schema.shape.kind.value === command.kind)
  ) {
    return false
  }
  const typed = command as CoordinatorCommand
  const item = state.workItems.find((entry) => entry.id === typed.workItemId)
  if (!item) {
    throw new Error('Outcome no longer exists.')
  }
  const note = (text: string) =>
    item.history.push({
      id: `${item.id}:${item.history.length}`,
      at: now,
      status: item.status,
      note: text
    })
  if (typed.kind === 'workItem.handBack') {
    if (!item.coordinator) {
      throw new Error('This outcome has no coordinator to hand back from.')
    }
    delete item.coordinator
    note('Handed back to the workbench coordinator')
    return true
  }
  if (item.status === 'accepted') {
    throw new Error('A signed-off outcome needs no coordinator.')
  }
  const role = state.roles.find((entry) => entry.id === typed.roleId)
  if (!role?.coordinator) {
    throw new Error('Choose the Outcome coordinator role.')
  }
  if (item.coordinator?.roleId !== role.id || item.coordinator.path !== typed.path) {
    item.coordinator = { roleId: role.id, path: typed.path, at: now }
    note(`Handed over to ${portfolioRoleLabel(role)}`)
  }
  return true
}
