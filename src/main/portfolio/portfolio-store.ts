import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { lock } from 'proper-lockfile'
import { PortfolioState, emptyPortfolio, parsePortfolioState } from '../../shared/portfolio'
import { writePluginFileAtomically } from '../plugins/installation/plugin-atomic-file-write'

export class PortfolioStore {
  // root holds what every workbench shares, such as the personal notes folder.
  constructor(
    readonly file: string,
    readonly root = dirname(file)
  ) {}

  async read(): Promise<PortfolioState> {
    try {
      return parsePortfolioState(JSON.parse(await readFile(this.file, 'utf8')))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return emptyPortfolio()
      }
      throw new Error('Cannot read Workbench data. The existing file has been preserved.', {
        cause: error
      })
    }
  }

  async update(
    revision: number | null,
    change: (state: PortfolioState) => void
  ): Promise<PortfolioState> {
    await mkdir(dirname(this.file), { recursive: true })
    const release = await lock(this.file, {
      realpath: false,
      retries: { retries: 10, minTimeout: 20, maxTimeout: 200 }
    })
    try {
      const state = await this.read()
      if (revision !== null && state.revision !== revision) {
        throw new Error('Workbench data changed in another window. Refresh and try again.')
      }
      change(state)
      state.revision += 1
      const validated = PortfolioState.parse(state)
      const contents = await readFile(this.file, 'utf8').catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return null
        }
        throw error
      })
      if (contents && [1, 2, 3, 4, 5].includes(JSON.parse(contents).schemaVersion)) {
        const backup = `${this.file}.v${JSON.parse(contents).schemaVersion}.bak`
        await writeFile(backup, contents, { flag: 'wx', mode: 0o600 }).catch(
          async (error: unknown) => {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
              throw error
            }
            if ((await readFile(backup, 'utf8')) !== contents) {
              throw new Error(
                'An existing migration backup differs from the current file. Workbench data has been preserved.'
              )
            }
          }
        )
      }
      await writePluginFileAtomically(this.file, JSON.stringify(validated, null, 2), {
        mode: 0o600
      })
      return validated
    } finally {
      await release()
    }
  }
}
