import { z } from 'zod'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { activateLocalFolderWorkspace } from './portfolio-folder-workspace'

const Indexed = z.object({ folder: z.string(), indexPath: z.string(), git: z.boolean() })

export async function choosePersonalNotesFolder(): Promise<boolean> {
  const folder = await window.api.shell.pickDirectory({})
  if (!folder) {
    return false
  }
  await callRuntimeRpc({ kind: 'local' }, 'portfolio.setPersonalNotesFolder', { folder })
  return true
}

// Refreshes INDEX.md, then opens the notes folder as a workspace with the index in front.
export async function openPersonalNotes(): Promise<void> {
  const current = z
    .object({ folder: z.string().nullable() })
    .parse(await callRuntimeRpc({ kind: 'local' }, 'portfolio.personalNotes', {}))
  if (!current.folder && !(await choosePersonalNotesFolder())) {
    return
  }
  const { folder, indexPath, git } = Indexed.parse(
    await callRuntimeRpc({ kind: 'local' }, 'portfolio.indexPersonalNotes', {})
  )
  const worktreeId = await activateLocalFolderWorkspace(folder, git ? 'git' : 'folder')
  useAppStore.getState().openFile({
    filePath: indexPath,
    relativePath: indexPath.slice(folder.length).replace(/^[\\/]+/, ''),
    worktreeId,
    runtimeEnvironmentId: null,
    language: 'markdown',
    mode: 'edit'
  })
}
