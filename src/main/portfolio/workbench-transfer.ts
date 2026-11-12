import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { strToU8, unzip, zip } from 'fflate'
import { z } from 'zod'
import { parsePortfolioState, type PortfolioState } from '../../shared/portfolio'
import {
  portfolioDesignAttachments,
  type PortfolioDesignAttachment
} from '../../shared/portfolio-design'
import {
  DEFAULT_WORKBENCH_ID,
  WorkbenchId,
  type PortfolioWorkbenchSummary
} from '../../shared/rpc-contract/portfolio-params'
import { portfolioDesignPath } from './portfolio-design-store'
import type { PortfolioStore } from './portfolio-store'
import { portfolioStewardDirectory } from './portfolio-steward'
import { workbenchStore } from './workbench-spaces'

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024
const MAX_ENTRIES = 2048
const Manifest = z
  .object({ format: z.literal('orca-workbench'), version: z.literal(1), state: z.unknown() })
  .strict()
const ATTACHMENT_ENTRY = /^attachments\/[a-f0-9]{64}\.(?:png|jpg|webp)$/

function attachmentEntry(store: PortfolioStore, attachment: PortfolioDesignAttachment): string {
  return `attachments/${basename(portfolioDesignPath(store, attachment))}`
}

function portableState(state: PortfolioState): PortfolioState {
  return parsePortfolioState({
    ...state,
    projects: state.projects.map((project) => ({ ...project, repoIds: [] })),
    tasks: state.tasks.map((task) => ({
      ...task,
      status: task.status === 'running' ? 'todo' : task.status,
      evidence: task.status === 'running' ? '' : task.evidence,
      history:
        task.status === 'running'
          ? [
              ...task.history,
              {
                id: randomUUID(),
                at: Date.now(),
                status: 'todo',
                note: 'Imported on another computer; the previous agent session is unavailable.'
              }
            ]
          : task.history,
      attempts: task.attempts.map(
        ({ handle: _handle, paneKey: _paneKey, sessionId: _sessionId, ...attempt }) => ({
          ...attempt,
          worktreeId: 'unlinked',
          state: 'closed'
        })
      )
    })),
    workItems: state.workItems.map(({ coordinator: _coordinator, ...item }) => item)
  })
}

export async function exportWorkbenchArchive(
  userData: string,
  id: string,
  destination: string
): Promise<void> {
  WorkbenchId.parse(id)
  const store = workbenchStore(userData, id)
  if (id !== DEFAULT_WORKBENCH_ID) {
    await stat(store.file)
  }
  const state = await store.read()
  const manifest = strToU8(JSON.stringify({ format: 'orca-workbench', version: 1, state }))
  if (manifest.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('Workbench data is too large to export.')
  }
  const files: Record<string, Uint8Array> = { 'manifest.json': manifest }
  let totalBytes = manifest.byteLength
  for (const attachment of portfolioDesignAttachments(state)) {
    const entry = attachmentEntry(store, attachment)
    if (files[entry]) {
      continue
    }
    const data = await readFile(portfolioDesignPath(store, attachment))
    if (
      data.byteLength !== attachment.bytes ||
      createHash('sha256').update(data).digest('hex') !== attachment.id
    ) {
      throw new Error(`Cannot export damaged design attachment: ${attachment.name}`)
    }
    totalBytes += data.byteLength
    if (Object.keys(files).length >= MAX_ENTRIES || totalBytes > MAX_ARCHIVE_BYTES) {
      throw new Error('Workbench archive exceeds the 256 MiB limit.')
    }
    files[entry] = data
  }
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data)))
  })
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('Workbench archive exceeds the 256 MiB limit.')
  }
  const temporary = `${destination}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, archive, { flag: 'wx', mode: 0o600 })
    await rename(temporary, destination)
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function importWorkbenchArchive(
  userData: string,
  archivePath: string
): Promise<{ workbench: PortfolioWorkbenchSummary; unlinkedProjects: number }> {
  const archiveStat = await stat(archivePath)
  if (!archiveStat.isFile() || archiveStat.size > MAX_ARCHIVE_BYTES) {
    throw new Error('Choose a Workbench archive no larger than 256 MiB.')
  }
  const archive = await readFile(archivePath)
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('Workbench archive exceeds its size limit.')
  }
  let declaredBytes = 0
  const seen = new Set<string>()
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      archive,
      {
        filter: (file) => {
          if (
            seen.has(file.name) ||
            (file.name !== 'manifest.json' && !ATTACHMENT_ENTRY.test(file.name))
          ) {
            throw new Error('Workbench archive contains an unexpected file.')
          }
          seen.add(file.name)
          declaredBytes += file.originalSize
          if (
            seen.size > MAX_ENTRIES ||
            declaredBytes > MAX_ARCHIVE_BYTES ||
            (file.name === 'manifest.json' && file.originalSize > MAX_MANIFEST_BYTES)
          ) {
            throw new Error('Workbench archive exceeds its size limit.')
          }
          return true
        }
      },
      (error, data) => (error ? reject(error) : resolve(data))
    )
  })
  if (
    Object.values(files).reduce((total, data) => total + data.byteLength, 0) > MAX_ARCHIVE_BYTES
  ) {
    throw new Error('Workbench archive exceeds its size limit.')
  }
  const manifestBytes = files['manifest.json']
  if (!manifestBytes || manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('Workbench archive has no valid manifest.')
  }
  const manifest = Manifest.parse(JSON.parse(Buffer.from(manifestBytes).toString('utf8')))
  const original = parsePortfolioState(manifest.state)
  const id = randomUUID()
  const store = workbenchStore(userData, id)
  const expected = new Set(['manifest.json'])
  const attachments = new Map<string, Uint8Array>()
  for (const attachment of portfolioDesignAttachments(original)) {
    const entry = attachmentEntry(store, attachment)
    expected.add(entry)
    const data = files[entry]
    if (
      !data ||
      data.byteLength !== attachment.bytes ||
      createHash('sha256').update(data).digest('hex') !== attachment.id
    ) {
      throw new Error(`Workbench archive has a missing or damaged attachment: ${attachment.name}`)
    }
    attachments.set(basename(entry), data)
  }
  if (Object.keys(files).some((entry) => !expected.has(entry))) {
    throw new Error('Workbench archive contains an unreferenced file.')
  }
  const state = portableState(original)
  const stagingRoot = join(userData, 'workbench', 'import-staging')
  await mkdir(stagingRoot, { recursive: true })
  const staging = await mkdtemp(join(stagingRoot, 'workbench-'))
  try {
    await writeFile(join(staging, 'portfolio.json'), JSON.stringify(state, null, 2), {
      mode: 0o600
    })
    if (attachments.size) {
      await mkdir(join(staging, 'design-attachments'))
      for (const [name, data] of attachments) {
        await writeFile(join(staging, 'design-attachments', name), data, { mode: 0o600 })
      }
    }
    await mkdir(dirname(dirname(store.file)), { recursive: true })
    await rename(staging, dirname(store.file))
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
  return {
    workbench: { id, name: state.organization, stewardPath: portfolioStewardDirectory(store) },
    unlinkedProjects: original.projects.filter((project) => project.repoIds.length > 0).length
  }
}
