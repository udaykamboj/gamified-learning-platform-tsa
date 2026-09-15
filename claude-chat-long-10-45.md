

Ran 3 commands
Removed chapters service; view courses page and registry
git rm -q -f services/courses/chapters.ts && sed -i "s/Mirrors updateCourseOrderStructure in/Mirrors the course chapter ordering endpoint in/" services/folders/folders.ts && cat "app/orgs/[orgslug]/(withmenu)/courses/courses.tsx"; grep -n "assignments\|migrate\|playgrounds\|boards" lib/dashboard-search/registry.ts
'use client'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useTranslation } from 'react-i18next'
import { BookCopy, Search, X, Users, Info, LogIn } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { searchMatchesAny } from '@/lib/search/normalize'
import { getUserGroups, getUserGroupResources } from '@services/usergroups/usergroups'
import { useCourses } from '@/hooks/queries/useCourses'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import CatalogPagination, { useCatalogPagination } from '@components/Objects/Catalog/CatalogPagination'
import { asArray } from '@services/utils/ts/requests'

interface CourseProps {
  orgslug: string
}

function Courses(props: CourseProps) {
  const { t } = useTranslation()
  const orgslug = props.orgslug
  const searchParams = useSearchParams()
  const isCreatingCourse = searchParams.get('new') ? true : false
  const [newCourseModal, setNewCourseModal] = React.useState(isCreatingCourse)
  const { isAdmin: isUserAdmin } = useAdminStatus()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const isAuthenticated = session?.status === 'authenticated'
  const { track } = useLHAnalytics('learner')
  const { data: coursesData, isLoading: coursesLoading } = useCourses(orgslug)

  const allCourses = coursesData || []

  // Usergroup filter — shown only when the org's plan actually includes
  // usergroups (a standard+ feature per the backend), via resolved features.
  const usergroupsAvailable = org?.config?.config?.resolved_features?.usergroups?.enabled ?? false
  const [usergroups, setUsergroups] = useState<any[]>([])
  const [selectedUsergroupId, setSelectedUsergroupId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lh_course_usergroup_filter') || ''
    }
    return ''
  })
  const [usergroupResourceUuids, setUsergroupResourceUuids] = useState<Set<string> | null>(null)
  const [showUsergroupInfo, setShowUsergroupInfo] = useState(false)

  // Fetch usergroups
  useEffect(() => {
    if (!usergroupsAvailable || !access_token || !org?.id) return
    getUserGroups(org?.id, access_token)
      .then((res: any) => {
        const list = asArray(res)
        setUsergroups(list)
        if (selectedUsergroupId && !list.some((ug: any) => String(ug.id) === selectedUsergroupId)) {
          setSelectedUsergroupId('')
          localStorage.removeItem('lh_course_usergroup_filter')
        }
      })
      .catch(() => setUsergroups([]))
  }, [usergroupsAvailable, access_token, org?.id])

  // Fetch resource UUIDs for selected usergroup
  useEffect(() => {
    if (!selectedUsergroupId || !access_token || !org?.id) {
      setUsergroupResourceUuids(null)
      return
    }
    getUserGroupResources(selectedUsergroupId, org?.id, access_token)
      .then((res: any) => {
        const uuids = asArray(res)
        setUsergroupResourceUuids(new Set(uuids))
      })
      .catch(() => setUsergroupResourceUuids(null))
  }, [selectedUsergroupId, access_token, org?.id])

  const handleUsergroupChange = (value: string) => {
    setSelectedUsergroupId(value)
    if (value) {
      localStorage.setItem('lh_course_usergroup_filter', value)
    } else {
      localStorage.removeItem('lh_course_usergroup_filter')
    }
  }

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter courses based on search and usergroup
  const filteredCourses = useMemo(() => {
    let courses = allCourses

    // Usergroup filter
    if (usergroupResourceUuids) {
      courses = courses.filter((course: any) => usergroupResourceUuids.has(course.course_uuid))
    }

    // Search filter
    if (searchQuery.trim()) {
      courses = courses.filter((course: any) =>
        searchMatchesAny([course.name, course.description, course.tags], searchQuery)
      )
    }

    return courses
  }, [allCourses, searchQuery, usergroupResourceUuids])

  // Track non-empty searches (debounced so we don't fire on every keystroke)
  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track(AnalyticsEvent.CourseSearched, {
        results_count: filteredCourses.length,
        total_courses: allCourses.length,
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, filteredCourses.length, allCourses.length, track])

  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedCourses,
    pageNumbers,
    goToPage,
    resetPage,
  } = useCatalogPagination(filteredCourses)

  // Reset to page 1 when search or filter changes
  React.useEffect(() => {
    resetPage()
  }, [searchQuery, selectedUsergroupId, resetPage])

  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }

  if (coursesLoading && !coursesData) {
    return (
      <div className="w-full animate-pulse">
        <GeneralWrapperStyled>
          <div className="flex flex-col space-y-2 mb-2">
            {/* Header row: title + button placeholder */}
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-9 bg-gray-200 rounded-lg w-32" />
            </div>
            {/* Search bar placeholder */}
            <div className="h-10 bg-gray-200 rounded-lg w-full sm:w-80 mb-4" />
            {/* Course card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden">
                  {/* Thumbnail area */}
                  <div className="bg-gray-200 w-full h-40 rounded-xl" />
                  {/* Card body */}
                  <div className="pt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GeneralWrapperStyled>
      </div>
    )
  }

  return (
    <FeatureGate feature="courses" orgslug={orgslug} context="public">
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('courses.courses')} type="cou" />
            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="courses"
              orgId={org?.id}
            >
              <Modal
                isDialogOpen={newCourseModal}
                onOpenChange={setNewCourseModal}
                minHeight="md"
                minWidth="lg"
                dialogContent={
                  <CreateCourseModal
                    closeModal={closeNewCourseModal}
                    orgslug={orgslug}
                  />
                }
                dialogTitle={t('courses.create_course')}
                dialogDescription={t('courses.create_new_course')}
                dialogTrigger={
                  <button>
                    <NewCourseButton />
                  </button>
                }
              />
            </AuthenticatedClientElement>
          </div>

          {/* Search and Usergroup Filter */}
          {allCourses.length > 0 && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative w-full sm:w-80">
                <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t('courses.search_courses')}
                  placeholder={t('courses.search_courses')}
                  className="w-full ps-10 pe-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute end-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Usergroup Filter */}
              {usergroupsAvailable && usergroups.length > 0 && (
                <div className="relative flex items-center gap-1.5">
                  <div className="relative">
                    <Users className="absolute start-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <select
                      value={selectedUsergroupId}
                      onChange={(e) => handleUsergroupChange(e.target.value)}
                      className="ps-8 pe-8 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0 appearance-none cursor-pointer min-w-[160px]"
                    >
                      <option value="">{t('courses.usergroup_filter.all_courses')}</option>
                      {usergroups.map((ug: any) => (
                        <option key={ug.id} value={String(ug.id)}>
                          {ug.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowUsergroupInfo(!showUsergroupInfo)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {showUsergroupInfo && (
                    <div className="absolute top-full start-0 mt-2 z-50 w-72 bg-white nice-shadow rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{t('courses.usergroup_filter.info_title')}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{t('courses.usergroup_filter.info_description')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              {t('courses.search_results', { count: filteredCourses.length, query: searchQuery })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedCourses.map((course: any, index: number) => (
              <div key={course.course_uuid} className="">
                <CourseThumbnail course={course} orgslug={orgslug} isPriority={currentPage === 1 && index < 3} />
              </div>
            ))}
            {filteredCourses.length === 0 && searchQuery && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4">
                <Search className="w-12 h-12 text-gray-300 dark:text-gray-500 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-200 mb-2">
                  {t('courses.no_search_results')}
                </h2>
                <p className="text-gray-400 dark:text-gray-500">
                  {t('courses.try_different_search')}
                </p>
              </div>
            )}
            {allCourses.length === 0 && !searchQuery && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 dark:border-white/10 rounded-2xl bg-gray-50/30 dark:bg-white/[0.03]">
                <div className="p-4 bg-white dark:bg-white/10 rounded-full nice-shadow mb-4">
                  {isAuthenticated ? (
                    <BookCopy className="w-8 h-8 text-gray-300 dark:text-gray-500" strokeWidth={1.5} />
                  ) : (
                    <LogIn className="w-8 h-8 text-gray-300 dark:text-gray-500" strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-xl font-bold text-gray-600 dark:text-gray-200 mb-2">
                  {isAuthenticated
                    ? t('courses.no_courses')
                    : t('courses.sign_in_to_see_courses', 'Log in to see your courses')}
                </h1>
                <p className="text-md text-gray-400 dark:text-gray-400 mb-6 text-center max-w-xs">
                  {!isAuthenticated ? (
                    t(
                      'courses.sign_in_to_see_courses_description',
                      'Courses in this academy may only be visible once you are signed in.',
                    )
                  ) : isUserAdmin ? (
                    t('courses.create_courses_placeholder')
                  ) : (
                    t('courses.no_courses_available')
                  )}
                </p>
                {/* An anonymous visitor sees an empty list whenever the org has no
                    PUBLIC courses — the API filters non-public ones out rather than
                    erroring, so "no courses" and "not signed in" are indistinguishable
                    from here. Prompt for sign-in instead of implying the academy is
                    empty. */}
                {!isAuthenticated && (
                  <Link
                    href={getUriWithOrg(orgslug, '/login')}
                    className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <LogIn size={16} />
                    {t('auth.sign_in', 'Sign in')}
                  </Link>
                )}
                {isAuthenticated && isUserAdmin && (
                  <div className="mt-4">
                    <AuthenticatedClientElement
                      action="create"
                      ressourceType="courses"
                      checkMethod="roles"
                      orgId={org?.id}
                    >
                      <button onClick={() => setNewCourseModal(true)}>
                        <NewCourseButton />
                      </button>
                    </AuthenticatedClientElement>
                  </div>
                )}
              </div>
            )}
          </div>

          <CatalogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageNumbers={pageNumbers}
            onPageChange={goToPage}
            previousLabel={t('pagination.previous')}
            nextLabel={t('pagination.next')}
            className="mt-8"
          />

          {/* Pagination info */}
          {totalPages > 1 && (
            <div className="mt-2 text-center text-sm text-gray-500">
              {t('pagination.showing_page', { current: currentPage, total: totalPages })}
            </div>
          )}
        </div>
      </GeneralWrapperStyled>
    </div>
    </FeatureGate>
  )
}

export default Courses
5:import { searchMeta as coursesMigrate } from '@/app/orgs/[orgslug]/dash/courses/migrate/page.search'
6:import { searchMeta as assignments } from '@/app/orgs/[orgslug]/dash/assignments/page.search'
9:import { searchMeta as playgrounds } from '@/app/orgs/[orgslug]/dash/playgrounds/page.search'
21:  assignments,
24:  playgrounds,
Clean student courses page and search registry
"C:/Users/megam/AppData/Local/Temp/claude/E--gamified-learning-platform-tsa/6d84ff1f-4eba-40d7-92c9-3029ba334f65/scratchpad/venv/Scripts/python.exe" - <<'EOF'
import pathlib,re
p=pathlib.Path("app/orgs/[orgslug]/(withmenu)/courses/courses.tsx")
s=p.read_text(encoding="utf-8")
def rep(a,b=""):
    global s
    assert a in s,a[:60]; s=s.replace(a,b)
def cut(a,b):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+s[j:]
rep("import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'\nimport Modal from '@components/Objects/StyledElements/Modal/Modal'\n")
rep("import { useSearchParams } from 'next/navigation'\n")
rep("import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'\n")
rep("import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'\nimport useAdminStatus from '@components/Hooks/useAdminStatus'\n")
rep("import { BookCopy, Search, X, Users, Info, LogIn } from 'lucide-react'","import { BookCopy, Search, X, LogIn } from 'lucide-react'")
rep("import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate'\nimport { useOrg } from '@components/Contexts/OrgContext'\n")
rep("import { getUserGroups, getUserGroupResources } from '@services/usergroups/usergroups'\n")
rep("import { asArray } from '@services/utils/ts/requests'\n")
rep("import React, { useState, useMemo, useEffect } from 'react'","import React, { useState, useMemo, useEffect } from 'react'")
rep("""  const searchParams = useSearchParams()
  const isCreatingCourse = searchParams.get('new') ? true : false
  const [newCourseModal, setNewCourseModal] = React.useState(isCreatingCourse)
  const { isAdmin: isUserAdmin } = useAdminStatus()
  const org = useOrg() as any
""")
rep("  const access_token = session?.data?.tokens?.access_token\n")
cut("  // Usergroup filter — shown only","  // Search state")
rep("  // Filter courses based on search and usergroup","  // Filter courses based on search")
rep("""    // Usergroup filter
    if (usergroupResourceUuids) {
      courses = courses.filter((course: any) => usergroupResourceUuids.has(course.course_uuid))
    }

""")
rep("  }, [allCourses, searchQuery, usergroupResourceUuids])","  }, [allCourses, searchQuery])")
rep("  // Reset to page 1 when search or filter changes","  // Reset to page 1 when search changes")
rep("  }, [searchQuery, selectedUsergroupId, resetPage])","  }, [searchQuery, resetPage])")
rep("""  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }

""")
rep("""            {/* Header row: title + button placeholder */}
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-9 bg-gray-200 rounded-lg w-32" />
            </div>""","""            {/* Header row: title placeholder */}
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
            </div>""")
rep('    <FeatureGate feature="courses" orgslug={orgslug} context="public">\n')
rep("    </FeatureGate>\n")
cut("            <AuthenticatedClientElement\n              checkMethod=\"roles\"","          </div>\n\n          {/* Search and Usergroup Filter */}")
rep("          {/* Search and Usergroup Filter */}","          {/* Search */}")
cut("              {/* Usergroup Filter */}","            </div>\n          )}\n\n          {/* Search Results Info */}")
rep("""                  ) : isUserAdmin ? (
                    t('courses.create_courses_placeholder')
                  ) : (""","""                  ) : (""")
cut("                {isAuthenticated && isUserAdmin && (","              </div>\n            )}\n          </div>\n\n          <CatalogPagination")
p.write_text(s,encoding="utf-8")

r=pathlib.Path("lib/dashboard-search/registry.ts"); t=r.read_text(encoding="utf-8")
for l in ["import { searchMeta as coursesMigrate } from '@/app/orgs/[orgslug]/dash/courses/migrate/page.search'\n","import { searchMeta as assignments } from '@/app/orgs/[orgslug]/dash/assignments/page.search'\n","import { searchMeta as playgrounds } from '@/app/orgs/[orgslug]/dash/playgrounds/page.search'\n","  assignments,\n","  playgrounds,\n"]:
    assert l in t,l; t=t.replace(l,"")
t=re.sub(r"\n\s*coursesMigrate,","",t)
r.write_text(t,encoding="utf-8")
print(t)
EOF
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
Inspected search metas and dashboard menus
cat "app/orgs/[orgslug]/dash/courses/page.search.ts" "app/orgs/[orgslug]/dash/communities/page.search.ts" "app/orgs/[orgslug]/dash/users/page.search.ts"; grep -n "usergroup\|roles\|'add'\|migrate\|assignments\|playground\|Practice\|edit\|/content\|/general\|Community\|communities" components/Dashboard/Menus/DashLeftMenu.tsx components/Dashboard/Menus/DashMobileMenu.tsx lib/dashboard-menu-items.ts | head -60
import { BookOpen } from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMeta: SearchMeta = {
  id: 'dash.courses',
  titleKey: 'common.all_courses',
  descriptionKey: 'dashboard.search.entries.courses.description',
  keywordsKey: 'dashboard.search.entries.courses.keywords',
  icon: BookOpen,
  href: '/dash/courses',
  group: 'navigation',
}
import { ChatsCircle } from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMeta: SearchMeta = {
  id: 'dash.communities',
  titleKey: 'communities.title',
  descriptionKey: 'dashboard.search.entries.communities.description',
  keywordsKey: 'dashboard.search.entries.communities.keywords',
  icon: ChatsCircle,
  href: '/dash/communities',
  group: 'navigation',
  featureKey: 'communities',
}
import {
  Users,
  UsersThree,
  ShieldCheck,
  UserPlus,
  ClipboardText,
} from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMetas: SearchMeta[] = [
  {
    id: 'dash.users.list',
    titleKey: 'dashboard.users.settings.tabs.users',
    descriptionKey: 'dashboard.search.entries.users.description',
    keywordsKey: 'dashboard.search.entries.users.keywords',
    icon: Users,
    href: '/dash/users/settings/users',
    group: 'users',
  },
  {
    id: 'dash.users.add',
    titleKey: 'dashboard.users.settings.tabs.add',
    descriptionKey: 'dashboard.search.entries.users_add.description',
    keywordsKey: 'dashboard.search.entries.users_add.keywords',
    icon: UserPlus,
    href: '/dash/users/settings/add',
    group: 'users',
  },
  {
    id: 'dash.users.usergroups',
    titleKey: 'dashboard.users.settings.tabs.usergroups',
    descriptionKey: 'dashboard.search.entries.usergroups.description',
    keywordsKey: 'dashboard.search.entries.usergroups.keywords',
    icon: UsersThree,
    href: '/dash/users/settings/usergroups',
    group: 'users',
  },
  {
    id: 'dash.users.roles',
    titleKey: 'dashboard.users.settings.tabs.roles',
    descriptionKey: 'dashboard.search.entries.roles.description',
    keywordsKey: 'dashboard.search.entries.roles.keywords',
    icon: ShieldCheck,
    href: '/dash/users/settings/roles',
    group: 'users',
  },
  {
    id: 'dash.users.signups',
    titleKey: 'dashboard.users.settings.tabs.signups',
    descriptionKey: 'dashboard.search.entries.signups.description',
    keywordsKey: 'dashboard.search.entries.signups.keywords',
    icon: UserPlus,
    href: '/dash/users/settings/signups',
    group: 'users',
  },
  {
    id: 'dash.users.audit_logs',
    titleKey: 'dashboard.users.settings.tabs.audit_logs',
    descriptionKey: 'dashboard.search.entries.users_audit_logs.description',
    keywordsKey: 'dashboard.search.entries.users_audit_logs.keywords',
    icon: ClipboardText,
    href: '/dash/users/settings/audit-logs',
    group: 'users',
  },
]
components/Dashboard/Menus/DashLeftMenu.tsx:70:import { getAssignmentsFromACourse } from '@services/courses/assignments'
components/Dashboard/Menus/DashLeftMenu.tsx:115:  // Lazy-load assignments only when the assignments hover menu is opened
components/Dashboard/Menus/DashLeftMenu.tsx:116:  const [assignmentsFetched, setAssignmentsFetched] = useState(false)
components/Dashboard/Menus/DashLeftMenu.tsx:119:    if (assignmentsFetched || !coursesData || !access_token) return
components/Dashboard/Menus/DashLeftMenu.tsx:185:  const showCommunities = isEnabled('communities')
components/Dashboard/Menus/DashLeftMenu.tsx:187:  const showPlaygrounds = isEnabled('playgrounds')
components/Dashboard/Menus/DashLeftMenu.tsx:365:                  <HoverMenuLabel className="text-white/70 font-medium">Practice &amp; tests</HoverMenuLabel>
components/Dashboard/Menus/DashLeftMenu.tsx:368:                    <Link href="/dash/assignments" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
components/Dashboard/Menus/DashLeftMenu.tsx:370:                      <span>{t('common.all_assignments')}</span>
components/Dashboard/Menus/DashLeftMenu.tsx:380:                            href={`/dash/assignments/${assignment.assignment_uuid.replace('assignment_', '')}?subpage=editor`}
components/Dashboard/Menus/DashLeftMenu.tsx:397:                const active = isActivePath('/dash/assignments')
components/Dashboard/Menus/DashLeftMenu.tsx:400:                    href="/dash/assignments"
components/Dashboard/Menus/DashLeftMenu.tsx:401:                    aria-label={t('dashboard.nav.open_assignments_menu')}
components/Dashboard/Menus/DashLeftMenu.tsx:425:                        <span className="text-sm font-medium flex-1 text-start">Practice &amp; tests</span>
components/Dashboard/Menus/DashLeftMenu.tsx:454:                href="/dash/playgrounds"
components/Dashboard/Menus/DashLeftMenu.tsx:456:                label={t('common.playgrounds')}
components/Dashboard/Menus/DashLeftMenu.tsx:458:                active={isActivePath('/dash/playgrounds')}
components/Dashboard/Menus/DashLeftMenu.tsx:463:                <NavGroupLabel label="Community" isCollapsed={isCollapsed} />
components/Dashboard/Menus/DashLeftMenu.tsx:465:                  href="/dash/communities"
components/Dashboard/Menus/DashLeftMenu.tsx:469:                  active={isActivePath('/dash/communities')}
components/Dashboard/Menus/DashLeftMenu.tsx:487:                    <Link href="/dash/users/settings/usergroups" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
components/Dashboard/Menus/DashLeftMenu.tsx:489:                      <span className="flex items-center">{t('dashboard.users.settings.tabs.usergroups')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="dark" /></span>
components/Dashboard/Menus/DashLeftMenu.tsx:493:                    <Link href="/dash/users/settings/roles" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
components/Dashboard/Menus/DashLeftMenu.tsx:495:                      <span className="flex items-center">{t('dashboard.users.settings.tabs.roles')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="dark" /></span>
components/Dashboard/Menus/DashLeftMenu.tsx:810:                  <Link href="/account/general" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
components/Dashboard/Menus/DashLeftMenu.tsx:855:// Section heading in the admin sidebar: Content / Community / People / Insights /
components/Dashboard/Menus/DashMobileMenu.tsx:109:          <PillLink href="/dash/assignments" icon={<Files size={18} weight="fill" />} active={isActive('/dash/assignments')} className="hidden min-[390px]:flex" />
components/Dashboard/Menus/DashMobileMenu.tsx:111:          {isEnabled('communities') && (
components/Dashboard/Menus/DashMobileMenu.tsx:112:            <PillLink href="/dash/communities" icon={<ChatsCircle size={18} weight="fill" />} active={isActive('/dash/communities')} className="hidden min-[470px]:flex" />
components/Dashboard/Menus/DashMobileMenu.tsx:117:          {isEnabled('playgrounds') && (
components/Dashboard/Menus/DashMobileMenu.tsx:118:            <PillLink href="/dash/playgrounds" icon={<Cube size={18} weight="fill" />} active={isActive('/dash/playgrounds')} className="hidden min-[590px]:flex" />
components/Dashboard/Menus/DashMobileMenu.tsx:121:          <PillLink href="/dash/org/settings/general" icon={<Buildings size={18} weight="fill" />} active={isActive('/dash/org')} className="hidden min-[670px]:flex" />
components/Dashboard/Menus/DashMobileMenu.tsx:216:                <PanelItem href="/dash/assignments" icon={<Files size={15} weight="fill" />} label="Practice & tests" active={isActive('/dash/assignments')} onClick={close} />
components/Dashboard/Menus/DashMobileMenu.tsx:218:                {isEnabled('communities') && <PanelItem href="/dash/communities" icon={<ChatsCircle size={15} weight="fill" />} label="Q&A moderation" active={isActive('/dash/communities')} onClick={close} />}
components/Dashboard/Menus/DashMobileMenu.tsx:220:                {isEnabled('playgrounds') && <PanelItem href="/dash/playgrounds" icon={<Cube size={15} weight="fill" />} label="Playgrounds" active={isActive('/dash/playgrounds')} onClick={close} />}
components/Dashboard/Menus/DashMobileMenu.tsx:222:                <PanelItem href="/dash/org/settings/general" icon={<Buildings size={15} weight="fill" />} label={t('common.organization')} active={isActive('/dash/org')} onClick={close} />
components/Dashboard/Menus/DashMobileMenu.tsx:227:                <PanelItem href="/account/general" icon={<Gear size={15} weight="fill" />} label={t('common.settings')} active={isActive('/account')} onClick={close} />
lib/dashboard-menu-items.ts:42:    id: 'assignments',
lib/dashboard-menu-items.ts:43:    href: '/dash/assignments',
lib/dashboard-menu-items.ts:45:    labelKey: 'common.assignments',
lib/dashboard-menu-items.ts:55:    id: 'communities',
lib/dashboard-menu-items.ts:56:    href: '/dash/communities',
lib/dashboard-menu-items.ts:58:    labelKey: 'communities.title',
lib/dashboard-menu-items.ts:59:    featureKey: 'communities',
lib/dashboard-menu-items.ts:77:    id: 'playgrounds',
lib/dashboard-menu-items.ts:78:    href: '/dash/playgrounds',
lib/dashboard-menu-items.ts:80:    labelKey: 'common.playgrounds',
lib/dashboard-menu-items.ts:81:    featureKey: 'playgrounds',
lib/dashboard-menu-items.ts:99:    href: '/dash/org/settings/general',
Updating the dashboard nav (left menu, mobile menu, menu items, user search entries).


Read 2 files
Read
DashLeftMenu.tsx
E:\gamified-learning-platform-tsa\apps\web\components\Dashboard\Menus\
DashLeftMenu.tsx
  HoverMenuLabel,
  HoverMenuSeparator,
} from "@components/ui/hover-menu"
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import { AVAILABLE_LANGUAGES } from '@/lib/languages'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { getAssignmentsFromACourse } from '@services/courses/assignments'
import { getDeploymentMode } from '@services/config/config'
import PlanBadge from '@components/Dashboard/Shared/PlanRestricted/PlanBadge'
import { usePlan } from '@components/Hooks/usePlan'
import { planMeetsRequirement } from '@services/plans/plans'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import OnboardingSidebarBox from '@components/Dashboard/Onboarding/OnboardingSidebarBox'
import { useOnboarding } from '@components/Hooks/useOnboarding'

function DashLeftMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { t, i18n } = useTranslation()
  const { track } = useLHAnalytics('dashboard')
  const pathname = usePathname() || ''
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Onboarding takes over the search slot until setup is complete / dismissed.
  const onboarding = useOnboarding()
  const showOnboarding =
    !isCollapsed && onboarding.welcomeSeen && !onboarding.dismissed && !onboarding.allCompleted

  const isActivePath = (path: string) => {
    if (path === '/dash') {
      return pathname === '/dash' || pathname === '/dash/'
    }
    return pathname === path || pathname.startsWith(path + '/')
  }
  const [recentAssignments, setRecentAssignments] = useState<any[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const access_token = session?.data?.tokens?.access_token

  // Fetch recent courses
  const { data: coursesData } = useQuery({
    queryKey: [...queryKeys.courses.list(org?.slug || ''), 'recent', 8],
    queryFn: async () => {
      const url = `${getAPIUrl()}courses/org_slug/${org.slug}/page/1/limit/8`
      const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, access_token))
      if (!res.ok) throw new Error('Failed to fetch courses')
      return res.json()
    },
    enabled: !!org?.slug,
    staleTime: 60_000,
  })
  const recentCourses = coursesData?.slice(0, 8) || []

  // Lazy-load assignments only when the assignments hover menu is opened
  const [assignmentsFetched, setAssignmentsFetched] = useState(false)

  const fetchAssignments = () => {
    if (assignmentsFetched || !coursesData || !access_token) return
    setAssignmentsFetched(true)
    const coursesToFetch = coursesData.slice(0, 5)
    const promises = coursesToFetch.map((course: any) =>
      getAssignmentsFromACourse(course.course_uuid, access_token)
    )
    Promise.all(promises).then((results) => {
      const allAssignments: any[] = []
      results.forEach((res: any, index: number) => {
        if (res?.data) {
          res.data.forEach((assignment: any) => {
            allAssignments.push({
              ...assignment,
              courseName: coursesToFetch[index].name
            })
          })
        }
      })
      setRecentAssignments(allAssignments.slice(0, 8))
    }).catch(() => {})
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dash-menu-collapsed')
      if (saved !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCollapsed(saved === 'true')
      }
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('dash-menu-collapsed', String(newState))
  }


  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org.slug, '/login') })
  }


  const plan = usePlan()
  const mode = getDeploymentMode()

  if (!org || !session) return null
  const planLabel =
    mode === 'ee' ? 'Enterprise Edition' :
    mode === 'oss' ? 'OSS' :
    plan  // SaaS: show actual plan name

  const planPillColor =
    mode === 'ee' ? 'bg-amber-400/15 text-amber-300' :
    mode === 'oss' ? 'bg-green-400/15 text-green-300' :
    plan === 'enterprise' ? 'bg-amber-400/15 text-amber-300' :
    plan === 'pro' ? 'bg-purple-400/15 text-purple-300' :
    plan === 'standard' ? 'bg-blue-400/15 text-blue-300' :
    'bg-white/[0.08] text-white/50'

  // Feature visibility from API resolved_features
  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const showLibrary = isEnabled('folders')
  const showCommunities = isEnabled('communities')
  const showPodcasts = isEnabled('podcasts')
  const showPlaygrounds = isEnabled('playgrounds')

  return (
    <TooltipProvider delayDuration={0}>
    <nav
      aria-label={t('dashboard.nav.sidebar_navigation')}
      className={cn(
        "flex flex-col text-white h-screen sticky top-0 z-overlay border-e border-white/[0.08] bg-[#0f0f10] transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className={cn(
        "relative flex items-center h-16 border-b border-white/[0.08] px-4 shrink-0",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <Link
          className={cn("flex items-center transition-opacity hover:opacity-70", isCollapsed ? "" : "space-x-3")}
          href={'/'}
        >
          {org?.logo_image ? (
            <img
              src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
              alt={org?.name}
              className="h-9 w-9 object-contain rounded-lg"
            />
          ) : (
            <img
              src="/starlab.svg"
              alt="Starlab logo"
              className="h-7 w-auto object-contain"
            />
          )}
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-white truncate">
                {org?.name}
              </span>
              <span className={cn(
                "mt-0.5 inline-flex w-fit items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                planPillColor
              )}>
                {planLabel}
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            aria-label={t('dashboard.nav.collapse_sidebar')}
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <SidebarSimple size={18} weight="fill" />
          </button>
        )}

        {/* Onboarding progress reuses this header's bottom border as its track —
            a neon purple gradient that glows out from the border. */}
        {showOnboarding && (
          <>
            {/* faint full-width track so the border reads as purple even at 0% */}
            <div className="absolute -bottom-px start-0 end-0 h-[2px] bg-indigo-500/15" />
            <motion.div
              className="absolute -bottom-px start-0 h-[2px] rounded-e-full"
              style={{
                background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)',
                boxShadow:
                  '0 0 6px rgba(139,92,246,0.85), 0 0 14px rgba(168,85,247,0.55), 0 0 2px rgba(99,102,241,0.9)',
              }}
              initial={false}
              animate={{ width: `${Math.max(onboarding.progress * 100, 6)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </>
        )}
      </div>

      {/* Search trigger — replaced by the onboarding progress in this slot until
          setup is complete (then the search box returns). */}
      <div className={cn('px-3', showOnboarding ? 'pt-2' : 'pt-3')}>
        {showOnboarding ? (
          <OnboardingSidebarBox />
        ) : (
          <CommandPaletteTrigger isCollapsed={isCollapsed} />
        )}
      </div>

      {/* Main Navigation - Vertically Centered */}
      <div className="flex-1 flex flex-col justify-center py-4 px-3">
        <AdminAuthorization authorizationMode="component">
          <div className="space-y-1">
            <MenuLink
              href="/dash"
              icon={<House size={20} weight="fill" />}
              label={t('common.home')}
              isCollapsed={isCollapsed}
              active={isActivePath('/dash')}
              onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'home' })}
            />

            <NavGroupLabel label="Content" isCollapsed={isCollapsed} />
            {/* Courses with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-white/70 font-medium">{t('courses.courses')}</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/courses" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <BookOpen size={16} weight="fill" />
                      <span>{t('common.all_courses')}</span>
                    </Link>
                  </HoverMenuItem>
                  {recentCourses.length > 0 && (
                    <>
                      <HoverMenuSeparator />
                      <HoverMenuLabel className="text-white/40">{t('common.recent')}</HoverMenuLabel>
                      {recentCourses.map((course: any) => (
                        <HoverMenuItem key={course.course_uuid} asChild>
                          <Link
                            href={`/dash/courses/course/${course.course_uuid.replace('course_', '')}/settings`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                          >
                            <PencilSimple size={14} className="text-white/40" />
                            <span className="truncate">{course.name}</span>
                          </Link>
                        </HoverMenuItem>
                      ))}
                    </>
                  )}
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/courses')
                return (
                  <Link
                    href="/dash/courses"
                    aria-label={t('dashboard.nav.open_courses_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-white bg-white/[0.08]"
                        : "text-white/50 hover:text-white hover:bg-white/[0.08]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-white rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <BookOpen size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-white/60" : "text-white/30")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('courses.courses')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-white/70" : "text-white/40"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Assignments with hover menu */}
            <div onMouseEnter={fetchAssignments}>
            <HoverMenu
              content={
                <HoverMenuContent className="w-72">
                  <HoverMenuLabel className="text-white/70 font-medium">Practice &amp; tests</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/assignments" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <Files size={16} weight="fill" />
                      <span>{t('common.all_assignments')}</span>
                    </Link>
                  </HoverMenuItem>
                  {recentAssignments.length > 0 && (
                    <>
                      <HoverMenuSeparator />
                      <HoverMenuLabel className="text-white/40">{t('common.recent')}</HoverMenuLabel>
                      {recentAssignments.map((assignment: any) => (
                        <HoverMenuItem key={assignment.assignment_uuid} asChild>
                          <Link
                            href={`/dash/assignments/${assignment.assignment_uuid.replace('assignment_', '')}?subpage=editor`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                          >
                            <PencilSimple size={14} className="text-white/40" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{assignment.title}</span>
                              <span className="text-xs text-white/30 truncate">{assignment.courseName}</span>
                            </div>
                          </Link>
                        </HoverMenuItem>
                      ))}
                    </>
                  )}
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/assignments')
                return (
                  <Link
                    href="/dash/assignments"
                    aria-label={t('dashboard.nav.open_assignments_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-white bg-white/[0.08]"
                        : "text-white/50 hover:text-white hover:bg-white/[0.08]",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-white rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <Files size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-white/60" : "text-white/30")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">Practice &amp; tests</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-white/70" : "text-white/40"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>
            </div>
            {showLibrary && (
              <MenuLink
                href="/dash/library"
                icon={<FolderSimple size={20} weight="fill" />}
                label={t('library.library')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/library')}
              />
            )}
            {showPodcasts && (
              <MenuLink
                href="/dash/podcasts"
                icon={<Headphones size={20} weight="fill" />}
                label={t('podcasts.podcasts')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/podcasts')}
              />
            )}
            {showPlaygrounds && (
              <MenuLink
                href="/dash/playgrounds"
                icon={<Cube size={20} weight="fill" />}
                label={t('common.playgrounds')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/playgrounds')}
              />
            )}
            {showCommunities && (
              <>
                <NavGroupLabel label="Community" isCollapsed={isCollapsed} />
                <MenuLink
                  href="/dash/communities"
                  icon={<ChatsCircle size={20} weight="fill" />}
                  label="Q&A moderation"
                  isCollapsed={isCollapsed}
                  active={isActivePath('/dash/communities')}
                />
              </>
            )}
            <NavGroupLabel label="People" isCollapsed={isCollapsed} />
            {/* Users with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-white/70 font-medium">{t('common.users')}</HoverMenuLabel>
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/users" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <Users size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.users')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/usergroups" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <UsersThree size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.users.settings.tabs.usergroups')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="dark" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/roles" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <Shield size={16} weight="fill" />
                      <span className="flex items-center">{t('dashboard.users.settings.tabs.roles')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="dark" /></span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/signups" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <ClipboardText size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.signups')}</span>
                    </Link>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <Link href="/dash/users/settings/add" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                      <UserPlus size={16} weight="fill" />
                      <span>{t('dashboard.users.settings.tabs.add')}</span>
                    </Link>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/users')
                return (
                  <Link
                    href="/dash/users/settings/users"
                    aria-label={t('dashboard.nav.open_users_menu')}
                    aria-current={active ? 'page' : undefined}
Read
dashboard-menu-items.ts
E:\gamified-learning-platform-tsa\apps\web\lib\
dashboard-menu-items.ts
import {
  House,
  BookOpen,
  Files,
  Users,
  CurrencyCircleDollar,
  Buildings,
  ChatsCircle,
  ChalkboardSimple,
  Cube,
  FolderSimple,
  Headphones,
  ChartBar,
  Code,
} from '@phosphor-icons/react'

export interface DashboardMenuItem {
  id: string
  href: string
  icon: typeof House
  labelKey: string
  /** Feature key used for plan-based gating. If undefined, item is always shown. */
  featureKey?: string
  /** If true, the feature defaults to disabled (must be explicitly enabled). */
  defaultDisabled?: boolean
}

export const DASHBOARD_MENU_ITEMS: DashboardMenuItem[] = [
  {
    id: 'home',
    href: '/dash',
    icon: House,
    labelKey: 'common.home',
  },
  {
    id: 'courses',
    href: '/dash/courses',
    icon: BookOpen,
    labelKey: 'courses.courses',
  },
  {
    id: 'assignments',
    href: '/dash/assignments',
    icon: Files,
    labelKey: 'common.assignments',
  },
  {
    id: 'library',
    href: '/dash/library',
    icon: FolderSimple,
    labelKey: 'library.library',
    featureKey: 'folders',
  },
  {
    id: 'communities',
    href: '/dash/communities',
    icon: ChatsCircle,
    labelKey: 'communities.title',
    featureKey: 'communities',
  },
  {
    id: 'podcasts',
    href: '/dash/podcasts',
    icon: Headphones,
    labelKey: 'podcasts.podcasts',
    featureKey: 'podcasts',
  },
  {
    id: 'boards',
    href: '/dash/boards',
    icon: ChalkboardSimple,
    labelKey: 'common.boards',
    featureKey: 'boards',
    defaultDisabled: true,
  },
  {
    id: 'playgrounds',
    href: '/dash/playgrounds',
    icon: Cube,
    labelKey: 'common.playgrounds',
    featureKey: 'playgrounds',
    defaultDisabled: true,
  },
  {
    id: 'users',
    href: '/dash/users/settings/users',
    icon: Users,
    labelKey: 'common.users',
  },
  {
    id: 'payments',
    href: '/dash/payments/overview',
    icon: CurrencyCircleDollar,
    labelKey: 'common.payments',
    featureKey: 'payments',
  },
  {
    id: 'organization',
    href: '/dash/org/settings/general',
    icon: Buildings,
    labelKey: 'common.organization',
  },
  {
    id: 'analytics',
    href: '/dash/analytics',
    icon: ChartBar,
    labelKey: 'common.analytics',
  },
  {
    id: 'developers',
    href: '/dash/developers/api',
    icon: Code,
    labelKey: 'dashboard.developers.breadcrumb',
  },
]
Session limit reached
Try again after your session limit resets.
Edited 50 files

00-requirements.md
+64
-0

01-plan.md
+79
-0

02-progress.md
+93
-8

constants.py
+11
-25

__init__.py
+4
-8

Show 45 more


