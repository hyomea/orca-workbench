import type { SidebarListModel, SidebarListModelArgs } from './sidebar-list-model'
import { useMemo } from 'react'
import { useSidebarExternalWorktreeCards } from './use-external-worktree-cards'
import { useSidebarHostVisibleScope } from './use-host-visible-scope'
import { useSidebarSectionRows } from './use-section-rows'
import { useSidebarWorktreeSortOrder } from './use-sort-order'
import { useOrderHeldWhileEngaged } from './use-order-hold'
import { useVisibleSidebarWorktrees } from './use-visible-worktrees'
import {
  visibleSidebarFolder,
  visibleSidebarRepo,
  visibleSidebarSetup,
  visibleSidebarWorktree
} from './steward-sidebar-visibility'

export function useWindowSidebarListModel(args: SidebarListModelArgs): SidebarListModel {
  const { filterState, sortBy, repoMap, defaultHostId } = args
  const repos = useMemo(
    () => args.repos.filter((repo) => visibleSidebarRepo(repo, args.hiddenLocalPaths)),
    [args.repos, args.hiddenLocalPaths]
  )
  const sortedIds = useOrderHeldWhileEngaged(
    useSidebarWorktreeSortOrder({ repoMap, sortBy }),
    sortBy
  )
  const { visibleWorktrees: allVisibleWorktrees, pairedDeviceIdsByEnvironment } =
    useVisibleSidebarWorktrees({
      filterState,
      sortBy,
      sortedIds,
      repoMap,
      worktreeLineageById: args.worktreeLineageById,
      defaultHostId,
      agentSendTargetWorktreeId: args.agentSendTargetWorktreeId
    })
  const visibleWorktrees = useMemo(
    () =>
      allVisibleWorktrees.filter((worktree) =>
        visibleSidebarWorktree(worktree, args.hiddenLocalPaths)
      ),
    [allVisibleWorktrees, args.hiddenLocalPaths]
  )
  const folderWorkspaces = useMemo(
    () =>
      args.folderWorkspaces.filter((folder) => visibleSidebarFolder(folder, args.hiddenLocalPaths)),
    [args.folderWorkspaces, args.hiddenLocalPaths]
  )
  const visibleScope = useSidebarHostVisibleScope({
    filterState,
    defaultHostId,
    repos,
    projectGroups: args.projectGroups,
    folderWorkspaces,
    pairedDeviceIdsByEnvironment
  })
  const externalWorktreeCards = useSidebarExternalWorktreeCards({
    repos,
    visibleReposForRows: visibleScope.visibleReposForRows,
    detectedWorktreesByRepo: args.detectedWorktreesByRepo,
    filterRepoIds: filterState.filterRepoIds
  })
  const rowModel = useSidebarSectionRows({
    groupBy: args.groupBy,
    sortBy: args.sortBy,
    projectOrderBy: args.projectOrderBy,
    pinnedDisplayPolicy: args.pinnedDisplayPolicy,
    defaultHostId,
    worktrees: visibleWorktrees,
    repos,
    repoMap,
    worktreeMap: args.worktreeMap,
    worktreeLineageById: args.worktreeLineageById,
    prCache: args.prCache,
    settings: args.settings,
    workspaceStatuses: args.workspaceStatuses,
    effectiveCollapsedGroups: args.collapsedGroups,
    agentSendTargetWorktreeId: args.agentSendTargetWorktreeId,
    projectGrouping: {
      ...args.projectGrouping,
      projectHostSetups: args.projectGrouping.projectHostSetups.filter((setup) =>
        visibleSidebarSetup(setup, args.hiddenLocalPaths)
      )
    },
    visibleReposForRows: visibleScope.visibleReposForRows,
    visibleProjectGroupsForRows: visibleScope.visibleProjectGroupsForRows,
    visibleFolderWorkspacesForRows: visibleScope.visibleFolderWorkspacesForRows,
    importedWorktreesByRepo: externalWorktreeCards.importedWorktreesByRepo,
    newExternalWorktreesInboxByRepo: externalWorktreeCards.newExternalWorktreesInboxByRepo,
    filterRepoIds: filterState.filterRepoIds,
    visibleWorkspaceHostIds: filterState.visibleWorkspaceHostIds,
    workspaceHostScope: filterState.workspaceHostScope
  })
  return { visibleWorktrees, visibleScope, externalWorktreeCards, rowModel }
}
