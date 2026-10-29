import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { PortfolioAgent, PortfolioCommand, type PortfolioState } from '../../../../shared/portfolio'
import { PortfolioField, PortfolioSelect } from './portfolio-controls'

export type PortfolioComposerKind = 'project' | 'role' | 'task' | 'organization'

export function PortfolioComposer({
  kind,
  state,
  projectId,
  repos,
  busy,
  saveError,
  onClose,
  onSave
}: {
  kind: PortfolioComposerKind
  state: PortfolioState
  projectId: string
  repos: readonly { id: string; name: string }[]
  busy: boolean
  saveError: string
  onClose: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [name, setName] = useState(kind === 'organization' ? state.organization : '')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [repoIds, setRepoIds] = useState<string[]>([])
  const [roleId, setRoleId] = useState(state.roles[0]?.id ?? '')
  const [agent, setAgent] = useState('codex')
  const [error, setError] = useState('')
  const title =
    kind === 'project'
      ? translate('portfolio.newProject', 'New project')
      : kind === 'role'
        ? translate('portfolio.newRole', 'New role')
        : kind === 'task'
          ? translate('portfolio.newTask', 'New task')
          : translate('portfolio.renameOrganization', 'Rename organization')

  async function submit(): Promise<void> {
    const candidate =
      kind === 'project'
        ? { kind: 'project.create', project: { name, objective: description, repoIds } }
        : kind === 'role'
          ? { kind: 'role.create', role: { name, responsibility: description, agent } }
          : kind === 'task'
            ? {
                kind: 'task.create',
                task: {
                  projectId,
                  roleId,
                  title: name,
                  instructions: description,
                  acceptanceCriteria: criteria
                }
              }
            : { kind: 'organization.rename', name }
    const parsed = PortfolioCommand.safeParse(candidate)
    if (!parsed.success) {
      setError(
        translate(
          'portfolio.completeFields',
          'Complete all fields and choose the required repositories or role.'
        )
      )
      return
    }
    setError('')
    if (await onSave(parsed.data)) {
      onClose()
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose()
        }
      }}
    >
      <SheetContent>
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {translate(
                'portfolio.composerDescription',
                'Define the outcome, ownership, and evidence needed to finish the work.'
              )}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-col gap-5 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <PortfolioField label={translate('portfolio.name', 'Name')}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={200}
              />
            </PortfolioField>
            {kind !== 'organization' && (
              <PortfolioField
                label={
                  kind === 'project'
                    ? translate('portfolio.objective', 'Objective')
                    : kind === 'role'
                      ? translate('portfolio.responsibility', 'Responsibility')
                      : translate('portfolio.instructions', 'Instructions')
                }
              >
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  maxLength={20000}
                  rows={5}
                />
              </PortfolioField>
            )}
            {kind === 'project' && (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium">
                  {translate('portfolio.repositories', 'Repositories and folders')}
                </legend>
                {repos.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {translate(
                      'portfolio.addRepoFirst',
                      'Add a repository or folder in the sidebar first.'
                    )}
                  </p>
                )}
                {repos.map((repo) => (
                  <label key={repo.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={repoIds.includes(repo.id)}
                      onCheckedChange={(checked) =>
                        setRepoIds((current) =>
                          checked === true
                            ? [...current, repo.id]
                            : current.filter((id) => id !== repo.id)
                        )
                      }
                    />
                    {repo.name}
                  </label>
                ))}
              </fieldset>
            )}
            {kind === 'role' && (
              <PortfolioSelect
                label={translate('portfolio.agent', 'Agent')}
                value={agent}
                onChange={setAgent}
                options={PortfolioAgent.options.map((id) => ({ id, name: id }))}
              />
            )}
            {kind === 'task' && (
              <>
                <PortfolioSelect
                  label={translate('portfolio.assignedRole', 'Assigned role')}
                  value={roleId}
                  onChange={setRoleId}
                  options={state.roles.map((role) => ({ id: role.id, name: role.name }))}
                />
                <PortfolioField
                  label={translate('portfolio.acceptanceCriteria', 'Acceptance criteria')}
                >
                  <Textarea
                    value={criteria}
                    onChange={(event) => setCriteria(event.target.value)}
                    required
                    maxLength={20000}
                    rows={4}
                  />
                </PortfolioField>
              </>
            )}
            {(error || saveError) && (
              <p role="alert" className="text-sm text-destructive">
                {error || saveError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
                {translate('portfolio.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? translate('portfolio.saving', 'Saving…')
                  : translate('portfolio.save', 'Save')}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
