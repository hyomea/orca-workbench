// External trackers whose items can be linked to a workspace.
export type TaskProvider = 'github' | 'gitlab' | 'linear' | 'jira'

export const TASK_PROVIDERS: readonly TaskProvider[] = ['github', 'gitlab', 'linear', 'jira']

const TASK_PROVIDER_SET = new Set<TaskProvider>(TASK_PROVIDERS)

export function isTaskProvider(value: unknown): value is TaskProvider {
  return TASK_PROVIDER_SET.has(value as TaskProvider)
}

// What the Tasks page can show: the external trackers plus Workbench tasks stored on this computer.
export type TaskSource = TaskProvider | 'workbench'

export const TASK_SOURCES: readonly TaskSource[] = [...TASK_PROVIDERS, 'workbench']

const TASK_SOURCE_SET = new Set<TaskSource>(TASK_SOURCES)

export function isTaskSource(value: unknown): value is TaskSource {
  return TASK_SOURCE_SET.has(value as TaskSource)
}

export function normalizeTaskProviderSettings(value: {
  visibleTaskProviders: unknown
  defaultTaskSource: unknown
}): { visibleTaskProviders: TaskSource[]; defaultTaskSource: TaskSource } {
  const visibleTaskProviders = normalizeVisibleTaskProviders(value.visibleTaskProviders)
  const defaultTaskSource = isTaskSource(value.defaultTaskSource)
    ? value.defaultTaskSource
    : resolveVisibleTaskProvider('github', visibleTaskProviders)

  if (visibleTaskProviders.includes(defaultTaskSource)) {
    return { visibleTaskProviders, defaultTaskSource }
  }

  // Repair older/drifted profiles whose saved default disappeared from the visible list.
  return {
    defaultTaskSource,
    visibleTaskProviders: TASK_SOURCES.filter(
      (provider) => provider === defaultTaskSource || visibleTaskProviders.includes(provider)
    )
  }
}

export function normalizeVisibleTaskProviders(value: unknown): TaskSource[] {
  if (!Array.isArray(value)) {
    return [...TASK_SOURCES]
  }

  const normalized: TaskSource[] = []
  for (const provider of value) {
    if (!TASK_SOURCE_SET.has(provider as TaskSource)) {
      continue
    }
    if (!normalized.includes(provider as TaskSource)) {
      normalized.push(provider as TaskSource)
    }
  }

  // Keep a selectable source after hydration or manual settings edits.
  return normalized.length > 0 ? normalized : [...TASK_SOURCES]
}

export type TaskProviderAvailability = {
  gitlabInstalled: boolean
  linearConnected: boolean
}

export function filterAvailableTaskProviders(
  visibleProviders: readonly TaskSource[],
  availability: TaskProviderAvailability
): TaskSource[] {
  const available = visibleProviders.filter((provider) =>
    isTaskProviderAvailable(provider, availability)
  )

  return available.length > 0 ? available : ['github']
}

export function restoreAvailableDefaultTaskProvider(
  visibleProviders: readonly TaskSource[],
  availability: TaskProviderAvailability,
  preferredProvider: unknown
): TaskSource[] {
  const available = filterAvailableTaskProviders(visibleProviders, availability)

  // Retain access to a saved default even when other providers become available.
  if (
    isTaskSource(preferredProvider) &&
    isTaskProviderAvailable(preferredProvider, availability) &&
    !available.includes(preferredProvider)
  ) {
    return TASK_SOURCES.filter(
      (provider) => provider === preferredProvider || available.includes(provider)
    )
  }

  return available
}

function isTaskProviderAvailable(
  provider: TaskSource,
  availability: TaskProviderAvailability
): boolean {
  if (provider === 'github') {
    return true
  }
  if (provider === 'gitlab') {
    return availability.gitlabInstalled
  }
  // Disconnected Jira must remain visible as its own first-time setup entry point.
  // Workbench is stored on this computer and needs no connection.
  if (provider === 'jira' || provider === 'workbench') {
    return true
  }
  return availability.linearConnected
}

export function resolveVisibleTaskProvider(
  preferred: TaskSource | null | undefined,
  visibleProviders: readonly TaskSource[]
): TaskSource {
  if (preferred && visibleProviders.includes(preferred)) {
    return preferred
  }
  return visibleProviders[0] ?? 'github'
}
