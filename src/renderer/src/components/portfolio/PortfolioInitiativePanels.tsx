import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import type { PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabel } from '../../../../shared/portfolio-roles'

// Setup and reference material an initiative needs now and then, opened beside the outcomes
// rather than shown all the time.
export function PortfolioPanel({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-sleek">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

// The agents tasks can be assigned to: who they are and what each is responsible for.
export function PortfolioAgents({
  roles,
  onCreateRole,
  onEditRole
}: {
  roles: PortfolioState['roles']
  onCreateRole: () => void
  onEditRole: (roleId: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={onCreateRole}>
        <Plus aria-hidden="true" />
        {translate('portfolio.addRole', 'Add role')}
      </Button>
      {roles.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                aria-label={translate('portfolio.editRoleNamed', 'Edit role {{name}}', {
                  name: portfolioRoleLabel(role)
                })}
                onClick={() => onEditRole(role.id)}
                className="w-full space-y-1 px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="min-w-0 break-words text-sm font-medium">
                    {portfolioRoleLabel(role)}
                  </span>
                  <span className="text-2xs text-muted-foreground">{role.agent}</span>
                </span>
                <span className="block break-words text-xs leading-relaxed text-muted-foreground">
                  {role.responsibility}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate('portfolio.rolesHint', 'Add a role to give an agent a clear responsibility.')}
        </p>
      )}
    </div>
  )
}

// What every agent working on the initiative is told: its objective and the repositories it uses.
export function PortfolioInitiativeContext({
  project,
  repos
}: {
  project: PortfolioState['projects'][number]
  repos: readonly { id: string; name: string }[]
}): React.JSX.Element {
  return (
    <section className="space-y-3 border-b border-border pb-4">
      <h3 className="text-sm font-medium">{translate('portfolio.objective', 'Objective')}</h3>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
        {project.objective}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.repoIds.map((id) => (
          <Badge key={id} variant="outline" className="max-w-full whitespace-normal break-all">
            {repos.find((repo) => repo.id === id)?.name ??
              translate('portfolio.unavailableRepository', 'Unavailable repository')}
          </Badge>
        ))}
      </div>
    </section>
  )
}
