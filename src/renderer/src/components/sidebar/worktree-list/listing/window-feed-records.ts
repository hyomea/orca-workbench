import { parseExecutionHostId } from '../../../../../../shared/execution-host'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspaces/folder-workspace-types'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../../../shared/worktree/types'

export function folderRecordKey(id: string, hostId: string | null | undefined): string {
  return `${parseExecutionHostId(hostId)?.id ?? ''}\0${id}`
}

export function windowRecordOf(
  records: ReadonlyMap<string, Worktree>,
  worktree: Worktree
): Worktree {
  return records.get(getWorktreeHostIdentity(worktree)) ?? worktree
}

export function windowFolderRecordOf(
  records: ReadonlyMap<string, FolderWorkspace>,
  folder: FolderWorkspace
): FolderWorkspace {
  return records.get(folderRecordKey(folder.id, folder.executionHostId)) ?? folder
}
