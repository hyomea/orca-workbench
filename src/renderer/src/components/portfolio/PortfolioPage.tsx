import { z } from 'zod'
import { MAX_PORTFOLIO_IMAGE_BYTES } from '../../../../shared/portfolio-design'
import { PortfolioDesignContext, portfolioImageBase64 } from './portfolio-design-actions'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { translate } from '@/i18n/i18n'
import type { PortfolioCommand } from '../../../../shared/portfolio'
import { PortfolioBoard } from './PortfolioBoard'
import { usePortfolioWorkbench } from './use-portfolio-workbench'
import { openPortfolioTaskChanges } from './portfolio-task-review-actions'
import { portfolioSetupActions } from './portfolio-setup-actions'
import { openPortfolioSteward } from './portfolio-steward-actions'
import { activeWorkbenchParams } from './workbench-selection'
import { choosePersonalNotesFolder, openPersonalNotes } from './portfolio-personal-notes-actions'

export default function PortfolioPage(): React.JSX.Element {
  const { state, error, loadError, busy, setError, refresh, mutate, repos, workspaces } =
    usePortfolioWorkbench()
  const profileId = useAppStore((s) => s.activeOrcaProfileId)
  const activity = useAppStore((s) => s.agentStatusByPaneKey)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const openTaskPage = useAppStore((s) => s.openTaskPage)
  // Steward and notes open in other workspaces; a failure is reported here on the Workbench page.
  const openElsewhere = (action: () => Promise<void>): void => {
    setError('')
    action().catch((failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }
  if (!state) {
    return (
      <div className="space-y-4 p-6">
        <p role={loadError ? 'alert' : 'status'}>
          {loadError || translate('portfolio.loading', 'Loading initiatives…')}
        </p>
        {loadError && (
          <Button variant="outline" onClick={() => void refresh()}>
            {translate('portfolio.retry', 'Retry')}
          </Button>
        )}
      </div>
    )
  }
  return (
    <PortfolioDesignContext
      value={{
        attach: async (workItemId, file) => {
          if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
            throw new Error(
              translate('portfolio.imageTooLarge', 'Choose an image no larger than 5 MiB.')
            )
          }
          return mutate('portfolio.attachDesign', {
            workItemId,
            name: file.name,
            mimeType: file.type,
            base64: await portfolioImageBase64(file)
          })
        },
        remove: (workItemId, attachmentId) =>
          mutate('portfolio.removeDesign', { workItemId, attachmentId }),
        read: async (attachmentId) => {
          const image = z
            .object({
              mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
              base64: z.string()
            })
            .parse(
              await callRuntimeRpc({ kind: 'local' }, 'portfolio.readDesign', {
                ...activeWorkbenchParams(),
                attachmentId
              })
            )
          return `data:${image.mimeType};base64,${image.base64}`
        }
      }}
    >
      <PortfolioBoard
        draftScope={profileId ?? 'local-default'}
        setupActions={portfolioSetupActions}
        state={state}
        repos={repos}
        workspaces={workspaces}
        activity={activity}
        busy={busy}
        error={error || loadError}
        onRefresh={() => {
          setError('')
          void refresh()
        }}
        onSave={(command: PortfolioCommand) => mutate('portfolio.mutate', { command })}
        onLaunch={(taskId, worktreeId) => mutate('portfolio.launch', { taskId, worktreeId })}
        onOpenSteward={(prompt) => openElsewhere(() => openPortfolioSteward(prompt))}
        onOpenTasks={(projectId) =>
          openTaskPage({ taskSource: 'workbench', workbenchProjectId: projectId })
        }
        onOpenPersonalNotes={() => openElsewhere(openPersonalNotes)}
        onChoosePersonalNotesFolder={() =>
          openElsewhere(async () => {
            if (await choosePersonalNotesFolder()) {
              await openPersonalNotes()
            }
          })
        }
        onExportNotes={async (projectId) => {
          const directory = await window.api.shell.pickDirectory({})
          if (!directory) {
            return null
          }
          const result = z.object({ written: z.number() }).parse(
            await callRuntimeRpc({ kind: 'local' }, 'portfolio.exportNotes', {
              ...activeWorkbenchParams(),
              projectId,
              directory
            })
          )
          return { directory, written: result.written }
        }}
        onReviewChanges={(id) => openElsewhere(() => openPortfolioTaskChanges(id))}
        onOpenWorkspace={(id) => {
          if (setActiveWorktree(id, 'local')) {
            setActiveView('terminal')
          }
        }}
      />
    </PortfolioDesignContext>
  )
}
