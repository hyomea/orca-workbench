import { translate } from '@/i18n/i18n'

export function portfolioRoleTemplates() {
  return [
    {
      id: 'analyst',
      name: translate('portfolio.roleAnalyst', 'Product Analyst'),
      responsibility:
        'Use the project objective, Jira context, existing behavior, and design references to define the user problem and scope. Deliver a brief, testable acceptance criteria shared by iOS and Android, edge cases, and open questions. Separate confirmed requirements from assumptions. Ask for review before treating a proposal as the specification.'
    },
    {
      id: 'designer',
      name: translate('portfolio.roleDesigner', 'Product Designer'),
      responsibility:
        'Use the shared acceptance criteria and design references to define flows, screens, loading, empty, error, and accessibility states. Deliver design notes with intended shared behavior and justified native platform differences. Inspect attached screenshots when available; report any references you cannot access. Identify missing decisions for human review.'
    },
    {
      id: 'ios',
      name: translate('portfolio.roleIOS', 'iOS Engineer'),
      responsibility:
        'Implement the assigned iOS work against the shared acceptance criteria, design references, and confirmed test scenarios. Inspect existing architecture and follow repository conventions. Preserve intended native behavior while matching shared outcomes. Deliver changes, focused tests, build and environment details, evidence, and remaining gaps. Do not change requirements to match implementation or claim Android verification.'
    },
    {
      id: 'android',
      name: translate('portfolio.roleAndroid', 'Android Engineer'),
      responsibility:
        'Implement the assigned Android work against the shared acceptance criteria, design references, and confirmed test scenarios. Inspect existing architecture and follow repository conventions. Preserve intended native behavior while matching shared outcomes. Deliver changes, focused tests, build and environment details, evidence, and remaining gaps. Do not change requirements to match implementation or claim iOS verification.'
    },
    {
      id: 'qa',
      name: translate('portfolio.roleQA', 'Parity QA'),
      responsibility:
        'Derive shared test scenarios from the acceptance criteria and designs. Specify steps, test data, expected behavior, and intentional platform differences. Compare each platform to the agreed requirements, not merely to the other platform. Deliver a per-platform report with build, environment, reproducible steps, evidence, failures, and blockers. Never claim tests ran without actual evidence. Propose fix tasks and retest affected scenarios; leave acceptance to human review.'
    }
  ]
}
