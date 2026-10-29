import { lstat, open, realpath } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { spawnBundledRipgrep } from '../ripgrep/bundled-ripgrep-spawn'
import { stopBundledRipgrep } from '../ripgrep/bundled-ripgrep-stop'

export type PortfolioSourceRoot = { name: string; path: string }
const SKIP =
  /(^|\/)(\.[^/]+|node_modules|vendor|dist|build|out|coverage|target|secrets?|credentials?)(\/|$)|(?:^|\/)(?:\.env.*|.*\.(?:pem|key|p12|pfx|lock))$/i
const DOCUMENT =
  /(?:^|\/)(?:readme[^/]*|architecture[^/]*|overview[^/]*|vision[^/]*|roadmap[^/]*)\.(?:md|txt)$|^docs\/[^/]+\.md$/i
const MANIFEST = /(?:^|\/)(?:package\.json|Cargo\.toml|pyproject\.toml|go\.mod|composer\.json)$/
const CODE = /^(?:src|app|lib)\/[^/]+\.(?:tsx?|jsx?|py|rs|go)$/

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
  const material: {
    project: string
    files: string[]
    excerpts: { path: string; text: string }[]
  }[] = []
  const sources: string[] = []
  let limited = false
  let budget = 48000
  for (const source of roots) {
    signal.throwIfAborted()
    const root = await realpath(source.path)
    const listing = await listSourcePaths(root, signal)
    const paths = listing.paths.filter((path) => !SKIP.test(path))
    const ranked = paths
      .filter((path) => DOCUMENT.test(path) || MANIFEST.test(path) || CODE.test(path))
      .sort((a, b) => {
        const score = (p: string): number =>
          /^readme\./i.test(p) ? 0 : DOCUMENT.test(p) ? 1 : MANIFEST.test(p) ? 2 : 3
        return score(a) - score(b) || a.localeCompare(b)
      })
    const excerpts: { path: string; text: string }[] = []
    for (const path of ranked.slice(0, 12)) {
      signal.throwIfAborted()
      if (budget <= 0) {
        break
      }
      const text = await readExcerpt(root, path, Math.min(4000, budget)).catch(() => null)
      if (text === null) {
        continue
      }
      excerpts.push({ path, text })
      sources.push(`${source.name || basename(root)}/${path}`)
      budget -= Buffer.byteLength(text)
    }
    material.push({ project: source.name, files: paths.slice(0, 100), excerpts })
    limited ||=
      listing.limited ||
      paths.length > 100 ||
      ranked.length > excerpts.length ||
      excerpts.some((entry) => entry.text.endsWith('[excerpt truncated]'))
  }
  return { context: JSON.stringify(material), sources, limited }
}
