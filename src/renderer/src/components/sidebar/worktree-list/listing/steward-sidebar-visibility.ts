import { useMemo } from 'react'
import { useWorkbenchList } from '@/components/portfolio/workbench-selection'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspaces/folder-workspace-types'
import type { ProjectSectionSetup } from '../../../../../../shared/project-section-grouping'
import type { Repo } from '../../../../../../shared/repo-types'
import type { SidebarFeedDomains } from '../../../../../../shared/sidebar-list/sidebar-feed-domains'
import type { Worktree } from '../../../../../../shared/worktree/types'

export function useStewardSidebarHiddenPaths(): ReadonlySet<string> {
  const workbenches = useWorkbenchList()
  return useMemo(() => new Set(workbenches.map((entry) => entry.stewardPath)), [workbenches])
}

export function visibleSidebarRepo(repo: Repo, hiddenPaths: ReadonlySet<string>): boolean {
  return (
    !hiddenPaths.has(repo.path) ||
    !!repo.connectionId ||
    (repo.executionHostId != null && repo.executionHostId !== 'local')
  )
}

export function visibleSidebarWorktree(
  worktree: Worktree,
  hiddenPaths: ReadonlySet<string>
): boolean {
  return (worktree.hostId != null && worktree.hostId !== 'local') || !hiddenPaths.has(worktree.path)
}

export function visibleSidebarFolder(
  folder: FolderWorkspace,
  hiddenPaths: ReadonlySet<string>
): boolean {
  return (
    (folder.executionHostId != null && folder.executionHostId !== 'local') ||
    !hiddenPaths.has(folder.folderPath)
  )
}

export function visibleSidebarSetup(
  setup: ProjectSectionSetup,
  hiddenPaths: ReadonlySet<string>
): boolean {
  return setup.hostId !== 'local' || !hiddenPaths.has(setup.path)
}

export function withoutStewardSidebarWorkspaces(
  domains: SidebarFeedDomains,
  hiddenPaths: ReadonlySet<string>
): SidebarFeedDomains {
  if (hiddenPaths.size === 0) {
    return domains
  }
  return {
    ...domains,
    workspaces: new Map(
      [...domains.workspaces].filter(
        ([, row]) => row.hostId !== 'local' || !hiddenPaths.has(row.path)
      )
    )
  }
}
