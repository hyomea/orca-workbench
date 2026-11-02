import { lstat, open, realpath } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { spawnBundledRipgrep } from '../ripgrep/bundled-ripgrep-spawn'
import { stopBundledRipgrep } from '../ripgrep/bundled-ripgrep-stop'

export type PortfolioSourceRoot = { name: string; path: string }
const SKIP =
  /(^|\/)(\.[^/]+|node_modules|vendor|dist|build|out|coverage|target|secrets?|credentials?)(\/|$)|(?:^|\/)(?:\.env.*|.*\.(?:pem|key|p12|pfx|lock))$/i
const GUIDE = /(?:^|\/)(?:agents|claude)\.md$/i
const DOCUMENT =
  /(?:^|\/)(?:readme[^/]*|architecture[^/]*|overview[^/]*|vision[^/]*|roadmap[^/]*|contributing[^/]*)\.(?:md|txt)$|^docs\/[^/]+\.md$/i
const MANIFEST =
  /(?:^|\/)(?:package\.json|Cargo\.toml|pyproject\.toml|go\.mod|composer\.json|Package\.swift|(?:build|settings)\.gradle(?:\.kts)?|libs\.versions\.toml)$/
const CODE = /^(?:src|app|lib)\/[^/]+\.(?:tsx?|jsx?|py|rs|go|swift|kt|php)$/
const TOTAL_EXCERPT_BYTES = 120000
const GUIDE_EXCERPT_BYTES = 12000
const EXCERPT_BYTES = 4000
const MIN_EXCERPT_BYTES = 500
const MAX_FILES_PER_SOURCE = 12

function listSourcePaths(
  root: string,
  signal: AbortSignal
): Promise<{ paths: string[]; limited: boolean }> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = spawnBundledRipgrep(
      [
        '--files',
        '--null',
        '--no-config',
        '--no-require-git',
        '--max-depth',
        '4',
        '--glob',
        '!{node_modules,vendor,dist,build,out,coverage,target}/**',
        '.'
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let output = Buffer.alloc(0)
    let settled = false
    const finish = (error?: Error, limited = false): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      stopBundledRipgrep(child, false)
      if (error) {
        reject(error)
      } else {
        resolve({
          paths: output
            .toString('utf8')
            .split('\0')
            .slice(0, -1)
            .map((p) => p.replace(/^\.\//, '').replaceAll('\\', '/')),
          limited
        })
      }
    }
    const abort = (): void => finish(new Error('Project analysis canceled.'))
    const timer = setTimeout(
      () => finish(new Error('Reading the directory timed out. Choose a smaller directory.')),
      10000
    )
    child.stdout?.on('data', (chunk: Buffer) => {
      if (settled) {
        return
      }
      const remaining = 128000 - output.length
      output = Buffer.concat([output, chunk.subarray(0, remaining)])
      if (chunk.length >= remaining) {
        finish(undefined, true)
      }
    })
    child.stderr?.resume()
    child.on('error', (error) => finish(error))
    child.on('close', (code) =>
      finish(code === 0 || code === 1 ? undefined : new Error('Cannot list project files.'))
    )
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
    }
  })
}

async function readExcerpt(root: string, path: string, maxBytes: number): Promise<string | null> {
  const candidate = join(root, path)
  const target = await realpath(candidate)
  const rel = relative(root, target)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    return null
  }
  const stat = await lstat(candidate)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return null
  }
  const file = await open(candidate, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes)
    const { bytesRead } = await file.read(buffer, 0, maxBytes, 0)
    const text = buffer.subarray(0, bytesRead).toString('utf8')
    if (text.includes('\0')) {
      return null
    }
    return text + (stat.size > maxBytes ? '\n[excerpt truncated]' : '')
  } finally {
    await file.close()
  }
}

export async function collectPortfolioSourceContext(
  roots: readonly PortfolioSourceRoot[],
  signal: AbortSignal
): Promise<{ context: string; sources: string[]; limited: boolean }> {
  const scans: {
    label: string
    root: string
    paths: string[]
    ranked: { path: string; rank: number }[]
    next: number
    listingLimited: boolean
    excerpts: { path: string; text: string }[]
  }[] = []
  for (const source of roots) {
    signal.throwIfAborted()
    const root = await realpath(source.path)
    const listing = await listSourcePaths(root, signal)
    const paths = listing.paths.filter((path) => !SKIP.test(path))
    const ranked = paths
      .map((path) => ({ path, rank: evidenceRank(path) }))
      .filter((entry): entry is { path: string; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path))
    scans.push({
      label: source.name || basename(root),
      root,
      paths,
      ranked,
      next: 0,
      listingLimited: listing.limited,
      excerpts: []
    })
  }
  let budget = TOTAL_EXCERPT_BYTES
  const readNext = async (scan: (typeof scans)[number], allowance: number): Promise<number> => {
    let used = 0
    while (scan.next < scan.ranked.length && scan.excerpts.length < MAX_FILES_PER_SOURCE) {
      signal.throwIfAborted()
      const { path, rank } = scan.ranked[scan.next]
      const cap = Math.min(rank <= 1 ? GUIDE_EXCERPT_BYTES : EXCERPT_BYTES, allowance - used)
      if (cap < MIN_EXCERPT_BYTES) {
        break
      }
      scan.next += 1
      const text = await readExcerpt(scan.root, path, cap).catch(() => null)
      if (text !== null) {
        scan.excerpts.push({ path, text })
        used += Buffer.byteLength(text)
      }
    }
    return used
  }
  // Fair share first so a large early directory cannot starve later ones; leftovers fill a second pass.
  for (const [index, scan] of scans.entries()) {
    budget -= await readNext(scan, Math.floor(budget / (scans.length - index)))
  }
  for (const scan of scans) {
    budget -= await readNext(scan, budget)
  }
  const limited = scans.some(
    (scan) =>
      scan.listingLimited ||
      scan.paths.length > 100 ||
      scan.ranked.length > scan.excerpts.length ||
      scan.excerpts.some((entry) => entry.text.endsWith('[excerpt truncated]'))
  )
  return {
    context: JSON.stringify(
      scans.map((scan) => ({
        project: scan.label,
        files: scan.paths.slice(0, 100),
        excerpts: scan.excerpts
      }))
    ),
    sources: scans.flatMap((scan) => scan.excerpts.map((entry) => `${scan.label}/${entry.path}`)),
    limited
  }
}

// Agent instructions and the root README describe a repository best; nested docs are often vendored.
function evidenceRank(path: string): number | null {
  const depth = path.split('/').length - 1
  if (GUIDE.test(path) && depth <= 1) {
    return depth
  }
  if (/^readme[^/]*\.(?:md|txt)$/i.test(path)) {
    return 0
  }
  if (DOCUMENT.test(path) && depth <= 1) {
    return 2
  }
  if (MANIFEST.test(path) && depth <= 2) {
    return 3
  }
  if (DOCUMENT.test(path) || GUIDE.test(path)) {
    return 4
  }
  return CODE.test(path) ? 5 : null
}
