import React from 'react'
import { Bot, ChevronDown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { openPortfolioSteward } from '@/components/portfolio/portfolio-steward-actions'
import { useWorkbenchList } from '@/components/portfolio/workbench-selection'
import { parsePortfolioState } from '../../../../shared/portfolio'
import { DEFAULT_WORKBENCH_ID } from '../../../../shared/rpc-contract/portfolio-params'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export function SidebarWorkbenchStewardRow(): React.JSX.Element {
  const t = useTranslate()
  const workbenches = useWorkbenchList()
  const [agent, setAgent] = React.useState<'codex' | 'claude'>('claude')
  const [changingAgent, setChangingAgent] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (workbenches.length === 0) {
      return
    }
    void callRuntimeRpc({ kind: 'local' }, 'portfolio.read', {
      workbenchId: DEFAULT_WORKBENCH_ID
    })
      .then((value) => setAgent(parsePortfolioState(value).stewardAgent ?? 'claude'))
      .catch(() => {})
  }, [workbenches])

  const open = (): void => {
    setError('')
    void openPortfolioSteward(undefined, DEFAULT_WORKBENCH_ID).catch((failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }

  const chooseAgent = async (next: 'codex' | 'claude'): Promise<void> => {
    if (next === agent || changingAgent) {
      return
    }
    setError('')
    setChangingAgent(true)
    try {
      const scope = { workbenchId: DEFAULT_WORKBENCH_ID }
      const state = parsePortfolioState(
        await callRuntimeRpc({ kind: 'local' }, 'portfolio.read', scope)
      )
      await callRuntimeRpc({ kind: 'local' }, 'portfolio.mutate', {
        ...scope,
        revision: state.revision,
        command: { kind: 'steward.agent', agent: next }
      })
      setAgent(next)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setChangingAgent(false)
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="group flex items-center rounded-md hover:bg-worktree-sidebar-foreground/8">
        <button
          type="button"
          onClick={open}
          disabled={changingAgent}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 pl-8 text-left text-[13px] text-worktree-sidebar-foreground/60 hover:text-worktree-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
        >
          <Bot className="size-3.5 shrink-0" aria-hidden="true" />
          {t('portfolio.openStewardChat', 'Steward chat')}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={changingAgent}
              aria-label={t('portfolio.stewardAgentChoice', 'Steward agent (next session)')}
              className="mr-1 rounded p-0.5 text-worktree-sidebar-foreground/55 hover:text-worktree-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {t('portfolio.stewardAgentChoice', 'Steward agent (next session)')}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={agent}
              onValueChange={(next) => {
                if (next === 'codex' || next === 'claude') {
                  void chooseAgent(next)
                }
              }}
            >
              <DropdownMenuRadioItem value="codex">
                {t('portfolio.stewardAgentCodex', 'Codex')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="claude">
                {t('portfolio.stewardAgentClaude', 'Claude')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
