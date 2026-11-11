import { canEditPortfolioContext } from '../../../../shared/portfolio-design'
import { PortfolioDesignAttachments } from './PortfolioDesignAttachments'
import { PortfolioNextStep } from './PortfolioNextStep'
import { portfolioNextStep } from '../../../../shared/portfolio-next-step'
import { PortfolioDiscovery } from './PortfolioDiscovery'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { verificationProgress } from '../../../../shared/portfolio-verification'
import { PortfolioVerification } from './PortfolioVerification'
import { Badge } from '@/components/ui/badge'
import { PortfolioOutcomePhaseBadge, PortfolioOutcomeProgress } from './PortfolioOutcomeProgress'
import type { PortfolioTrack } from './portfolio-tracks'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand, PortfolioState } from '../../../../shared/portfolio'
import {
  portfolioTicketsText,
  type PortfolioFeature,
  type PortfolioWorkItem
} from '../../../../shared/portfolio-features'
import { PortfolioSpecification } from './PortfolioSpecification'
import { PortfolioChecklist } from './PortfolioChecklist'
import { PortfolioOutcomeInbox } from './PortfolioOutcomeInbox'
import { PortfolioWorkItemReview } from './PortfolioWorkItemReview'
import { workItemKinds } from './portfolio-feature-labels'
import { PortfolioTickets } from './PortfolioTickets'
import { PortfolioOutcomeScope } from './PortfolioOutcomeScope'

export function PortfolioWorkItemDetail({
  item,
  feature,
  state,
  tracks,
  busy,
  onSave,
  onEdit,
  onCreateTask,
  onSelectTask,
  onCreateRole,
  onOpenTasks,
  onDiscuss
}: {
  item: PortfolioWorkItem
  feature: PortfolioFeature | undefined
  state: PortfolioState
  tracks: readonly PortfolioTrack[]
  busy: boolean
  onSave: (command: PortfolioCommand) => Promise<boolean>
  onEdit: () => void
  onCreateTask: (workItemId: string) => void
  onSelectTask: (id: string) => void
  onCreateRole: () => void
  onOpenTasks: () => void
  onDiscuss: (prompt: string) => void
}): React.JSX.Element {
  const editable = canEditPortfolioContext(state, item.id)
  const [tab, setTab] = useState('context')
  const [editingScope, setEditingScope] = useState(false)
  const published = !!feature?.versions.some((version) => version.workItemId === item.id)
  const tasks = state.tasks.filter((task) => task.workItemId === item.id)
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
            <PortfolioOutcomePhaseBadge state={state} item={item} tracks={tracks} />
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
          team={
            state.projects.find((project) => project.id === item.projectId)?.reviewMode === 'team'
          }
          busy={busy}
          onSave={onSave}
          onClose={() => setEditingScope(false)}
        />
      )}
      {/* While the work runs, the progress rows below already point to Tasks. */}
      {portfolioNextStep(state, feature, item) !== 'tasks' && (
        <PortfolioNextStep
          state={state}
          feature={feature}
          item={item}
          busy={busy}
          onTab={setTab}
          onOpenTasks={onOpenTasks}
          onEdit={onEdit}
          onDiscuss={onDiscuss}
        />
      )}
      <PortfolioOutcomeInbox state={state} item={item} busy={busy} onSave={onSave} />
      <PortfolioDiscovery state={state} item={item} />
      <PortfolioOutcomeProgress
        state={state}
        item={item}
        tracks={tracks}
        busy={busy}
        onSave={onSave}
        onOpenTasks={onOpenTasks}
        onCreateTask={onCreateTask}
        onCreateRole={onCreateRole}
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto @md/project:w-fit @md/project:grid-cols-3">
          <TabsTrigger className="h-8" value="context">
            {translate('portfolio.definition', 'Definition')}
          </TabsTrigger>
          <TabsTrigger className="h-8" value="tests">
            {translate('portfolio.parityTests', 'Parity & tests')}
          </TabsTrigger>
          <TabsTrigger className="h-8" value="review">
            {translate('portfolio.workReviewTab', 'Sign-off')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="context" className="space-y-4">
          <PortfolioChecklist
            state={state}
            item={item}
            editable={item.status !== 'accepted' && !published}
            busy={busy}
            onSave={onSave}
          />
          {/* The checklist above shows the criteria; the rest of the definition follows. */}
          <PortfolioSpecification
            {...item}
            acceptanceCriteria=""
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
                'Use tasks to investigate and review the findings. To deliver a change, conclude the discovery as work and define its AC before creating a test plan.'
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
