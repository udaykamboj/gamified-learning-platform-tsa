import type { SearchMeta } from './types'

import { searchMeta as home } from '@/app/(dashboard)/dash/page.search'
import { searchMeta as courses } from '@/app/(dashboard)/dash/courses/page.search'
import { searchMeta as coursesMigrate } from '@/app/(dashboard)/dash/courses/migrate/page.search'
import { searchMeta as assignments } from '@/app/(dashboard)/dash/assignments/page.search'
import { searchMeta as communities } from '@/app/(dashboard)/dash/communities/page.search'
import { searchMeta as podcasts } from '@/app/(dashboard)/dash/podcasts/page.search'
import { searchMeta as boards } from '@/app/(dashboard)/dash/boards/page.search'
import { searchMeta as playgrounds } from '@/app/(dashboard)/dash/playgrounds/page.search'
import { searchMeta as analytics } from '@/app/(dashboard)/dash/analytics/page.search'
import { searchMetas as users } from '@/app/(dashboard)/dash/users/page.search'
import { searchMetas as org } from '@/app/(dashboard)/dash/org/page.search'
import { searchMetas as payments } from '@/app/(dashboard)/dash/payments/page.search'

export const dashboardPages: SearchMeta[] = [
  home,
  courses,
  coursesMigrate,
  assignments,
  communities,
  podcasts,
  boards,
  playgrounds,
  analytics,
  ...users,
  ...org,
  ...payments,
]
