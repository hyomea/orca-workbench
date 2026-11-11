import { portfolioRoleTemplates } from './portfolio-role-templates'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { PortfolioAgent, PortfolioCommand, type PortfolioState } from '../../../../shared/portfolio'
import { portfolioRoleLabel, portfolioWorkingRoles } from '../../../../shared/portfolio-roles'

type PortfolioRole = PortfolioState['roles'][number]
import { PortfolioField, PortfolioSelect } from './portfolio-controls'
import { stageName } from './portfolio-track-labels'
import { PORTFOLIO_STAGES } from './portfolio-tracks'

export type PortfolioComposerKind =
  | 'project'
  | 'project.idea'
  | 'project.edit'
  | 'role'
  | 'role.edit'
  | 'task'
  | 'organization'

export function PortfolioComposer({
  kind,
  state,
  projectId,
  workItemId,
  role,
  busy,
  saveError,
  onClose,
  onSave
}: {
  kind: 'role' | 'task' | 'organization'
  state: PortfolioState
  projectId: string
  workItemId?: string
  // Present when editing an existing role instead of creating one.
  role?: PortfolioRole
  busy: boolean
  saveError: string
  onClose: () => void
  onSave: (command: PortfolioCommand) => Promise<boolean>
}): React.JSX.Element {
  const [templateId, setTemplateId] = useState('analyst')
  const templates = portfolioRoleTemplates()
  const [name, setName] = useState(
    kind === 'organization' ? state.organization : (role?.name ?? '')
  )
  const [description, setDescription] = useState(role?.responsibility ?? '')
  const [criteria, setCriteria] = useState('')
  const [roleId, setRoleId] = useState(portfolioWorkingRoles(state)[0]?.id ?? '')
  const [agent, setAgent] = useState<string>(role?.agent ?? 'codex')
  const [agentName, setAgentName] = useState(role?.agentName ?? '')
  const [error, setError] = useState('')
  const [platform, setPlatform] = useState('shared')
  const [stage, setStage] = useState('development')
  const [linkedItem, setLinkedItem] = useState(workItemId ?? 'none')
  const items = state.workItems.filter(
    (item) => item.status !== 'accepted' && item.projectId === projectId
  )
  const title =
    kind === 'role'
      ? role
        ? translate('portfolio.editRole', 'Edit role')
        : translate('portfolio.newRole', 'New role')
      : kind === 'task'
        ? translate('portfolio.newTask', 'New task')
        : translate('portfolio.renameOrganization', 'Rename organization')

  async function submit(): Promise<void> {
    const roleInput = {
      name,
      responsibility: description,
      agent,
      ...(agentName.trim() ? { agentName } : {})
    }
    const candidate =
      kind === 'role'
        ? role
          ? {
              kind: 'role.update',
              roleId: role.id,
              role: roleInput,
              expected: {
                name: role.name,
                responsibility: role.responsibility,
                agent: role.agent,
                ...(role.agentName ? { agentName: role.agentName } : {})
              }
            }
          : { kind: 'role.create', role: roleInput }
        : kind === 'task'
          ? {
              kind: 'task.create',
              task: {
                projectId,
                ...(linkedItem !== 'none' ? { workItemId: linkedItem } : {}),
                roleId,
                platform,
                stage,
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
          'Complete the required fields and choose a role if needed.'
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
      <SheetContent className="w-full sm:max-w-lg">
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {kind === 'role'
                ? role
                  ? translate(
                      'portfolio.editRoleHint',
                      'Changes apply to tasks you start from now on. Running agents, and retries of an earlier launch, keep the instructions they started with.'
                    )
                  : translate(
                      'portfolio.roleStep',
                      'Choose an agent and a responsibility for each role.'
                    )
                : kind === 'task'
                  ? translate(
                      'portfolio.firstTaskHint',
                      'Describe the work, assign a role, and define what a successful result looks like.'
                    )
                  : translate(
                      'portfolio.organizationHint',
                      'Choose the name shown above your initiatives.'
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
            {kind === 'role' && !role && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <PortfolioSelect
                  label={translate('portfolio.roleTemplate', 'Role template')}
                  value={templateId}
                  onChange={setTemplateId}
                  disabled={busy}
                  options={templates.map(({ id, name }) => ({ id, name }))}
                />
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.roleTemplateHint',
                    'Apply a template to replace the name and responsibility below, then customize it and choose an agent. Tasks are assigned and launched manually.'
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    const template = templates.find((entry) => entry.id === templateId)
                    if (template) {
                      setName(template.name)
                      setDescription(template.responsibility)
                    }
                  }}
                >
                  {translate('portfolio.applyTemplate', 'Apply template')}
                </Button>
              </section>
            )}
            <PortfolioField
              label={
                kind === 'role'
                  ? translate('portfolio.roleName', 'Role name')
                  : translate('portfolio.name', 'Name')
              }
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={200}
              />
            </PortfolioField>
            {kind === 'role' && (
              <div className="flex flex-col gap-2">
                <PortfolioField label={translate('portfolio.agentName', 'Agent name (optional)')}>
                  <Input
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    maxLength={200}
                  />
                </PortfolioField>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'portfolio.agentNameHint',
                    'A name for this role’s agent, such as Nova. It is shown as “Nova · Android Engineer”, and the agent is told its name.'
                  )}
                </p>
              </div>
            )}
            {kind !== 'organization' && (
              <PortfolioField
                label={
                  kind === 'role'
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
                  label={translate('portfolio.targetPlatform', 'Target platform')}
                  value={platform}
                  onChange={setPlatform}
                  disabled={busy}
                  options={[
                    {
                      id: 'shared',
                      name: translate('portfolio.sharedPlatform', 'Shared / discovery')
                    },
                    { id: 'ios', name: 'iOS' },
                    { id: 'android', name: 'Android' },
                    { id: 'backend', name: translate('portfolio.backendWork', 'Backend / API') }
                  ]}
                />
                <PortfolioSelect
                  label={translate('portfolio.taskStage', 'Stage')}
                  value={stage}
                  onChange={setStage}
                  disabled={busy}
                  options={PORTFOLIO_STAGES.map((id) => ({ id, name: stageName(id) }))}
                />
                <PortfolioSelect
                  label={translate('portfolio.workItem', 'Outcome')}
                  value={linkedItem}
                  onChange={setLinkedItem}
                  disabled={busy}
                  options={[
                    {
                      id: 'none',
                      name: translate('portfolio.projectTask', 'Initiative task without an outcome')
                    },
                    ...items.map((item) => ({
                      id: item.id,
                      name: [
                        state.features.find((feature) => feature.id === item.featureId)?.name,
                        item.title
                      ]
                        .filter(Boolean)
                        .join(' / ')
                    }))
                  ]}
                />
                <PortfolioSelect
                  label={translate('portfolio.assignedRole', 'Assigned role')}
                  value={roleId}
                  onChange={setRoleId}
                  options={portfolioWorkingRoles(state).map((role) => ({
                    id: role.id,
                    name: portfolioRoleLabel(role)
                  }))}
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
