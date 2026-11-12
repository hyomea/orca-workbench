import { getAppEnvironment } from '../../../../../shared/app-environment'
import {
  PortfolioCreateWorkbench,
  PortfolioExportWorkbench,
  PortfolioImportWorkbench,
  PortfolioRemoveWorkbench,
  PortfolioWorkbenches
} from '../../../../../shared/rpc-contract/portfolio-params'
import {
  createWorkbench,
  listWorkbenches,
  removeWorkbench
} from '../../../../portfolio/workbench-spaces'
import {
  exportWorkbenchArchive,
  importWorkbenchArchive
} from '../../../../portfolio/workbench-transfer'
import { defineMethod } from '../../core'
import { getRuntimeDesktopSurface } from '../../../construction/runtime-desktop-surface'

function userData(): string {
  return getAppEnvironment().getPath('userData')
}

export const PORTFOLIO_WORKBENCH_METHODS = [
  defineMethod({
    name: 'portfolio.workbenches',
    permission: 'workspace',
    params: PortfolioWorkbenches,
    handler: () => listWorkbenches(userData())
  }),
  defineMethod({
    name: 'portfolio.createWorkbench',
    permission: 'workspace',
    params: PortfolioCreateWorkbench,
    handler: (params) => createWorkbench(userData(), params.name)
  }),
  defineMethod({
    name: 'portfolio.removeWorkbench',
    permission: 'workspace',
    params: PortfolioRemoveWorkbench,
    handler: (params) => removeWorkbench(userData(), params.workbenchId)
  }),
  defineMethod({
    name: 'portfolio.exportWorkbench',
    permission: 'workspace',
    params: PortfolioExportWorkbench,
    handler: async (params) => {
      const workbench = (await listWorkbenches(userData())).find(
        (entry) => entry.id === params.workbenchId
      )
      if (!workbench) {
        throw new Error('Workbench no longer exists. Refresh the list and try again.')
      }
      const safeName =
        Array.from(workbench.name, (char) =>
          char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char
        )
          .join('')
          .replace(/[/\\:*?"<>|]/g, '_')
          .replace(/[. ]+$/g, '')
          .slice(0, 100) || 'workbench'
      const pickPath = getRuntimeDesktopSurface().pickWorkbenchExportPath
      if (!pickPath) {
        throw new Error('Workbench export requires an Orca desktop window.')
      }
      const filePath = await pickPath(`Orca-${safeName}.orca-workbench.zip`)
      if (!filePath) {
        return null
      }
      await exportWorkbenchArchive(userData(), params.workbenchId, filePath)
      return filePath
    }
  }),
  defineMethod({
    name: 'portfolio.importWorkbench',
    permission: 'workspace',
    params: PortfolioImportWorkbench,
    handler: async () => {
      const pickPath = getRuntimeDesktopSurface().pickWorkbenchImportPath
      if (!pickPath) {
        throw new Error('Workbench import requires an Orca desktop window.')
      }
      const filePath = await pickPath()
      if (!filePath) {
        return null
      }
      return importWorkbenchArchive(userData(), filePath)
    }
  })
]
