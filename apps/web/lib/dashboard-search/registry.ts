import type { SearchMeta } from './types'

import { searchMeta as home } from '@/app/orgs/[orgslug]/dash/page.search'
import { searchMeta as courses } from '@/app/orgs/[orgslug]/dash/courses/page.search'
import { searchMeta as communities } from '@/app/orgs/[orgslug]/dash/communities/page.search'
import { searchMeta as podcasts } from '@/app/orgs/[orgslug]/dash/podcasts/page.search'
import { searchMeta as analytics } from '@/app/orgs/[orgslug]/dash/analytics/page.search'
import { searchMetas as users } from '@/app/orgs/[orgslug]/dash/users/page.search'
import { searchMetas as org } from '@/app/orgs/[orgslug]/dash/org/page.search'
import { searchMetas as account } from '@/app/orgs/[orgslug]/(withmenu)/account/page.search'

// Boards and payments are not indexed: they are not part of the StarLab admin
// (docs/refactor/03-change-list.md, sections B and H).
export const dashboardPages: SearchMeta[] = [
  home,
  courses,
  communities,
  podcasts,
  analytics,
  ...users,
  ...org,
  ...account,
]
