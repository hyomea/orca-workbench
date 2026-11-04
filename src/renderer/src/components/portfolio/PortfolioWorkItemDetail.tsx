import { canEditPortfolioContext } from '../../../../shared/portfolio-design'
import { PortfolioDesignAttachments } from './PortfolioDesignAttachments'
import { PortfolioNextStep } from './PortfolioNextStep'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { verificationProgress } from '../../../../shared/portfolio-verification'
import { PortfolioVerification } from './PortfolioVerification'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import {
  portfolioTicketsText,
  type PortfolioFeature,
  type PortfolioWorkItem
} from '../../../../shared/portfolio-features'
import { PortfolioSelect } from './portfolio-controls'
import { PortfolioSpecification } from './PortfolioSpecification'
import { PortfolioWorkItemReview } from './PortfolioWorkItemReview'
import { workItemKinds, workItemStatuses, workPlatformName } from './portfolio-feature-labels'
import { stageName } from './portfolio-track-labels'
import { PortfolioTickets } from './PortfolioTickets'
import { PortfolioOutcomeScope } from './PortfolioOutcomeScope'

export function PortfolioWorkItemDetail({
  item,
  feature,
  state,
  busy,
  onSave,
  onEdit,
  onCreateTask,
  onSelectTask,
  onCreateRole
}: {
  item: PortfolioWorkItem
  feature: PortfolioFeature | undefined
  state: PortfolioState
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onEdit: () => void
  onCreateTask: (workItemId: string) => void
  onSelectTask: (id: string) => void
  onCreateRole: () => void
}): React.JSX.Element {
  const editable = canEditPortfolioContext(state, item.id)
  const [tab, setTab] = useState('context')
  const [linkId, setLinkId] = useState('')
  const [editingScope, setEditingScope] = useState(false)
  const published = !!feature?.versions.some((version) => version.workItemId === item.id)
  const tasks = state.tasks.filter((task) => task.workItemId === item.id)
  const available = state.tasks.filter(
    (task) =>
      task.projectId === item.projectId &&
      !task.workItemId &&
      task.status === 'todo' &&
      (!task.attempts.length || task.attempts.at(-1)?.state === 'closed')
  )
  const baseline = feature?.versions.find((version) => version.version === item.baseVersion)
  return (
    <section className="space-y-5 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="break-words text-base font-semibold">{item.title}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {workItemKinds().find((kind) => kind.id === item.kind)?.name}
            </Badge>
            <Badge variant="secondary">
              {workItemStatuses().find((status) => status.id === item.status)?.name}
            </Badge>
            {item.parity && (
              <Badge variant="outline">
                {translate('portfolio.parityBadge', 'Same on iOS and Android')}
              </Badge>
            )}
            {feature && (
              <span className="text-xs text-muted-foreground">
                {translate('portfolio.outcomeFeature', '{{feature}} · specification v{{version}}', {
                  feature: feature.name,
                  version: item.baseVersion
                })}
              </span>
            )}
          </div>
          <PortfolioTickets tickets={item.tickets} />
        </div>
        <div className="flex flex-wrap gap-2">
          {item.status !== 'accepted' && !published && !editingScope && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditingScope(true)}
            >
              {translate('portfolio.editScope', 'Tickets, parity, and feature')}
            </Button>
          )}
          {editable && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onEdit}>
              {translate('portfolio.editOutcome', 'Edit outcome')}
            </Button>
          )}
        </div>
      </div>
      {editingScope && (
        <PortfolioOutcomeScope
          item={item}
          features={state.features.filter((entry) => entry.projectId === item.projectId)}
          busy={busy}
          onSave={onSave}
          onClose={() => setEditingScope(false)}
        />
      )}
      <PortfolioNextStep
        state={state}
        feature={feature}
        item={item}
        busy={busy}
        onTab={setTab}
        onEdit={onEdit}
        onCreateTask={onCreateTask}
        onCreateRole={onCreateRole}
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto @md/project:w-fit @md/project:grid-cols-4">
          <TabsTrigger className="h-8" value="context">
            {translate('portfolio.sharedContext', 'Shared context')}
          </TabsTrigger>
          <TabsTrigger className="h-8" value="tasks">
            {translate('portfolio.tasks', 'Tasks')}
          </TabsTrigger>
          <TabsTrigger className="h-8" value="tests">
            {translate('portfolio.parityTests', 'Parity & tests')}
          </TabsTrigger>
          <TabsTrigger className="h-8" value="review">
            {translate('portfolio.workReviewTab', 'Review')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="context" className="space-y-4">
          <PortfolioSpecification
            {...item}
            sourceReference={portfolioTicketsText(item.tickets)}
            designAttachments={editable ? undefined : item.designAttachments}
          />
          {editable && (
            <PortfolioDesignAttachments
              attachments={item.designAttachments}
              workItemId={item.id}
              editable
              busy={busy}
            />
          )}
          {baseline && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm">
                {translate(
                  'portfolio.baseSpecification',
                  'Original specification for this outcome'
                )}
              </summary>
              <div className="mt-4">
                <PortfolioSpecification {...baseline} />
              </div>
            </details>
          )}
        </TabsContent>
        <TabsContent value="tasks">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">
                {translate('portfolio.linkedTasks', 'Linked tasks')}
              </h4>
              {item.status !== 'accepted' && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => (state.roles.length ? onCreateTask(item.id) : onCreateRole())}
                >
                  {state.roles.length
                    ? translate('portfolio.newTask', 'New task')
                    : translate('portfolio.newRole', 'New role')}
                </Button>
              )}
            </div>
            {!tasks.length && (
              <p className="text-sm text-muted-foreground">
                {translate(
                  'portfolio.noLinkedTasks',
                  'No linked tasks yet. Add work for a role or attach an existing planned task.'
                )}
              </p>
            )}
            {tasks.map((task) => (
              <Button
                key={task.id}
                variant="outline"
                className="h-auto w-full justify-between gap-3 whitespace-normal py-3 text-left"
                onClick={() => onSelectTask(task.id)}
              >
                <span className="break-words">
                  {task.title}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[stageName(task.stage), task.platform && workPlatformName(task.platform)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Badge variant="outline">{task.status}</Badge>
              </Button>
            ))}
            {item.status !== 'accepted' && available.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <PortfolioSelect
                    label={translate('portfolio.existingTask', 'Existing planned task')}
                    value={linkId}
                    onChange={setLinkId}
                    disabled={busy}
                    options={available.map((task) => ({ id: task.id, name: task.title }))}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !linkId}
                  onClick={async () => {
                    if (
                      await onSave({
                        kind: 'task.linkWorkItem',
                        taskId: linkId,
                        workItemId: item.id
                      })
                    ) {
                      setLinkId('')
                    }
                  }}
                >
                  {translate('portfolio.linkTask', 'Link task')}
                </Button>
              </div>
            )}
          </section>
        </TabsContent>
        <TabsContent value="tests">
          {!item.parity ? (
            <p className="text-sm text-muted-foreground">
              {translate(
                'portfolio.noParityTests',
                'This outcome does not need identical behavior on iOS and Android, so no shared test plan is required. Each platform’s tasks carry their own verification.'
              )}
            </p>
          ) : item.kind === 'investigation' ? (
            <p className="text-sm text-muted-foreground">
              {translate(
                'portfolio.triageVerificationHint',
                'Use tasks to investigate and review the findings. To deliver a change, return to Planned, classify the outcome, and define its AC before creating a test plan.'
              )}
            </p>
          ) : (
            <PortfolioVerification
              state={state}
              item={item}
              busy={busy}
              onSave={onSave}
              onSelectTask={onSelectTask}
            />
          )}
        </TabsContent>
        <TabsContent value="review">
          <PortfolioWorkItemReview
            item={item}
            feature={feature}
            features={state.features.filter((entry) => entry.projectId === item.projectId)}
            tasks={tasks}
            verificationReady={verificationProgress(state, item.id).ready}
            busy={busy}
            onSave={onSave}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
