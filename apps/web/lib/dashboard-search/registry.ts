import type { SearchMeta } from './types'

import { searchMetas as account } from '@/app/orgs/[orgslug]/(withmenu)/account/page.search'

export const dashboardPages: SearchMeta[] = [
  ...account,
]
