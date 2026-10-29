import { ArrowRight, FolderKanban, ListChecks, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'

export function PortfolioWelcome({
  roleCount,
  onCreateProject,
  onCreateIdea,
  onCreateRole
}: {
  roleCount: number
  onCreateProject: () => void
  onCreateIdea: () => void
  onCreateRole: () => void
}): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 @2xl:px-8 @2xl:py-12">
      <div className="max-w-xl space-y-4">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-card-foreground">
          <FolderKanban className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-semibold">
          {translate('portfolio.welcomeTitle', 'Organize work across repositories')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {translate(
            'portfolio.welcomeDescription',
            'Connect repositories, give agents clear responsibilities, and review the results in one place.'
          )}
        </p>
      </div>
      <ol className="mt-8 grid gap-4 @2xl:grid-cols-3">
        <li className="flex">
          <Card className="w-full">
            <CardContent className="h-full">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <FolderKanban className="size-4" aria-hidden="true" />
                  <span className="text-xs tabular-nums">01</span>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-sm font-semibold">
                    {translate('portfolio.firstProject', 'Create your first project')}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {translate(
                      'portfolio.projectStep',
                      'Set an outcome and connect the repositories that belong to it.'
                    )}
                  </p>
                </div>
                <Button className="w-fit" onClick={onCreateProject}>
                  {translate('portfolio.importDirectory', 'Import directory')}
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button variant="ghost" className="w-fit" onClick={onCreateIdea}>
                  {translate('portfolio.fromIdea', 'Start with an idea')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
        <li className="flex">
          <Card className="w-full">
            <CardContent className="h-full">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  <span className="text-xs tabular-nums">02</span>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-sm font-semibold">
                    {translate('portfolio.defineRoles', 'Define your agent roles')}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {roleCount > 0
                      ? translate('portfolio.rolesReady', 'Roles available: {{total}}', {
                          count: roleCount
                        })
                      : translate(
                          'portfolio.roleStep',
                          'Choose an agent and a responsibility for each role.'
                        )}
                  </p>
                </div>
                <Button variant="outline" className="w-fit" onClick={onCreateRole}>
                  {translate('portfolio.newRole', 'New role')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
        <li className="flex">
          <Card className="w-full">
            <CardContent className="h-full">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <ListChecks className="size-4" aria-hidden="true" />
                  <span className="text-xs tabular-nums">03</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {translate('portfolio.assignAndReview', 'Assign tasks and review results')}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {translate(
                      'portfolio.taskStep',
                      'Inside a project, define tasks, start agents, and accept completed work.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      </ol>
    </main>
  )
}
