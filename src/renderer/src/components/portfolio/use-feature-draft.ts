import {
  PortfolioIntakeResult,
  PortfolioIntakeSource,
  type PortfolioIntakeFields
} from '../../../../shared/portfolio-intake'
import { PortfolioJiraPreview } from './portfolio-context-sources'
import { useState } from 'react'
import { z } from 'zod'
import { useTaskCreationDraftRetention } from '@/components/use-task-creation-draft-retention'
import {
  PortfolioWorkItemInput,
  type PortfolioWorkItem,
  type PortfolioFeature
} from '../../../../shared/portfolio-features'

const IntakeField = z.enum([
  'title',
  'description',
  'acceptanceCriteria',
  'designReferences',
  'sourceReference'
])
const Draft = z.object({
  intakeEditedFields: z.array(IntakeField).optional(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.string(),
  acceptanceCriteria: z.string(),
  designReferences: z.string(),
  sourceReference: z.string(),
  contextUrl: z.string().optional(),
  contextKind: z.string().optional(),
  contextPreview: PortfolioJiraPreview.optional(),
  intakeAgent: z.string().optional(),
  intakeLanguage: z.string().optional(),
  intakeNotes: z.string().optional(),
  intakeSources: z.array(PortfolioIntakeSource).optional(),
  intakeResult: PortfolioIntakeResult.optional(),
  expected: PortfolioWorkItemInput.optional(),
  baseVersion: z.number().int().nonnegative().optional()
})
type Draft = z.infer<typeof Draft>
const memory = new Map<string, Draft | null>()
const keyFor = (key: string): string => `orca:feature-draft:${key}`
function read(key: string): Draft | null {
  if (memory.has(key)) {
    return memory.get(key) ?? null
  }
  try {
    const parsed = Draft.safeParse(JSON.parse(sessionStorage.getItem(keyFor(key)) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
function write(key: string, value: Draft | null): void {
  memory.set(key, value)
  try {
    if (value) {
      sessionStorage.setItem(keyFor(key), JSON.stringify(value))
    } else {
      sessionStorage.removeItem(keyFor(key))
    }
  } catch {
    /* Retain the in-memory draft when storage is unavailable. */
  }
}
export function useFeatureDraft(
  key: string,
  item?: PortfolioWorkItem,
  initialKind = 'initial',
  specification?: PortfolioFeature['versions'][number]
) {
  const [draft, setDraft] = useState<Draft>(
    () =>
      read(key) ?? {
        name: '',
        intakeEditedFields: item ? [...IntakeField.options] : [],
        title: item?.title ?? '',
        description: item?.description ?? specification?.description ?? '',
        kind: item?.kind ?? initialKind,
        acceptanceCriteria: item?.acceptanceCriteria ?? specification?.acceptanceCriteria ?? '',
        designReferences: item?.designReferences ?? specification?.designReferences ?? '',
        sourceReference: item?.sourceReference ?? specification?.sourceReference ?? '',
        expected: item && PortfolioWorkItemInput.parse(item),
        baseVersion: item?.baseVersion ?? specification?.version ?? 0
      }
  )
  const discard = useTaskCreationDraftRetention({
    open: true,
    draft,
    writeDraft: (value) => write(key, value)
  })
  function field(
    name: keyof Omit<
      Draft,
      | 'expected'
      | 'baseVersion'
      | 'contextPreview'
      | 'intakeSources'
      | 'intakeResult'
      | 'intakeEditedFields'
    >,
    value: string
  ): void {
    setDraft((current) => {
      const protectedField = IntakeField.options.find((key) => key === name)
      return {
        ...current,
        [name]: value,
        intakeEditedFields: protectedField
          ? [...new Set([...(current.intakeEditedFields ?? []), protectedField])]
          : current.intakeEditedFields
      }
    })
  }
  function preview(contextPreview: PortfolioJiraPreview | undefined): void {
    setDraft((current) => ({ ...current, contextPreview }))
  }
  function reference(designReferences: string): void {
    setDraft((current) => ({ ...current, designReferences }))
  }
  function rememberSources(intakeSources: PortfolioIntakeSource[]): void {
    setDraft((current) => ({ ...current, intakeSources }))
  }
  function applyIntake(result: PortfolioIntakeResult): void {
    setDraft((current) => {
      const fields: PortfolioIntakeFields = { ...result.fields }
      for (const key of [
        'title',
        'description',
        'acceptanceCriteria',
        'designReferences',
        'sourceReference'
      ] as const) {
        if (
          current.intakeEditedFields?.includes(key) ||
          (current.intakeEditedFields === undefined &&
            current[key] &&
            current[key] !== current.intakeResult?.fields[key])
        ) {
          fields[key] = current[key]
        }
      }
      return { ...current, ...fields, intakeResult: result, contextUrl: '' }
    })
  }
  return { draft, field, discard, preview, reference, rememberSources, applyIntake }
}
