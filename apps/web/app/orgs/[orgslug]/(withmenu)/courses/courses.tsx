'use client'
import React, { useState, useMemo, useEffect } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import { useTranslation } from 'react-i18next'
import { BookCopy, Search, X, LogIn } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { searchMatchesAny } from '@/lib/search/normalize'
import { useCourses } from '@/hooks/queries/useCourses'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import CatalogPagination, { useCatalogPagination } from '@components/Objects/Catalog/CatalogPagination'
import EmptyState from '@components/Objects/StyledElements/EmptyState/EmptyState'
import SearchField from '@components/Objects/StyledElements/Form/SearchField'

interface CourseProps {
  orgslug: string
}

function Courses(props: CourseProps) {
  const { t } = useTranslation()
  const orgslug = props.orgslug
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'
  const { track } = useLHAnalytics('learner')
  const { data: coursesData, isLoading: coursesLoading } = useCourses(orgslug)

  const allCourses = coursesData || []

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter courses based on search
  const filteredCourses = useMemo(() => {
    let courses = allCourses

    // Search filter
    if (searchQuery.trim()) {
      courses = courses.filter((course: any) =>
        searchMatchesAny([course.name, course.description, course.tags], searchQuery)
      )
    }

    return courses
  }, [allCourses, searchQuery])

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

  // Reset to page 1 when search changes
  React.useEffect(() => {
    resetPage()
  }, [searchQuery, resetPage])

  if (coursesLoading && !coursesData) {
    return (
      <div className="w-full animate-pulse">
        <GeneralWrapperStyled>
          <div className="flex flex-col space-y-2 mb-2">
            {/* Header row: title placeholder */}
            <div className="mb-6 flex items-center gap-3">
              <div className="size-10 rounded-[10px] bg-muted" />
              <div className="h-9 w-40 rounded-[10px] bg-muted" />
            </div>
            {/* Search bar placeholder */}
            <div className="mb-4 h-11 w-full rounded-[10px] bg-muted sm:w-80" />
            {/* Course card grid — matches CourseThumbnail geometry */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="sl-card overflow-hidden">
                  <div className="aspect-video w-full bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 rounded-[6px] bg-muted" />
                    <div className="h-3 w-1/2 rounded-[6px] bg-muted" />
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
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('courses.courses')} type="cou" />
          </div>

          {/* Search */}
          {allCourses.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                label={t('courses.search_courses')}
              />
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <p className="mb-2 text-meta text-muted-foreground" aria-live="polite">
              {t('courses.search_results', { count: filteredCourses.length, query: searchQuery })}
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {paginatedCourses.map((course: any, index: number) => (
              <div key={course.course_uuid} className="">
                <CourseThumbnail course={course} orgslug={orgslug} isPriority={currentPage === 1 && index < 3} />
              </div>
            ))}
            {filteredCourses.length === 0 && searchQuery && (
              <EmptyState
                className="col-span-full"
                icon={<Search />}
                title={t('courses.no_search_results')}
                description={t('courses.try_different_search')}
                action={
                  <button type="button" onClick={() => setSearchQuery('')} className="sl-btn sl-btn-secondary">
                    <X size={16} aria-hidden /> Clear search
                  </button>
                }
              />
            )}
            {allCourses.length === 0 && !searchQuery && (
              /* An anonymous visitor sees an empty list whenever the org has no
                 PUBLIC courses — the API filters non-public ones out rather than
                 erroring, so "no courses" and "not signed in" are indistinguishable
                 from here. Prompt for sign-in instead of implying the academy is
                 empty. */
              <EmptyState
                className="col-span-full"
                icon={isAuthenticated ? <BookCopy /> : <LogIn />}
                title={
                  isAuthenticated
                    ? t('courses.no_courses')
                    : t('courses.sign_in_to_see_courses', 'Log in to see your courses')
                }
                description={
                  !isAuthenticated
                    ? t(
                        'courses.sign_in_to_see_courses_description',
                        'Courses in this academy may only be visible once you are signed in.',
                      )
                    : t('courses.no_courses_available')
                }
                action={
                  !isAuthenticated && (
                    <Link href={getUriWithOrg(orgslug, '/login')} className="sl-btn sl-btn-primary">
                      <LogIn size={16} aria-hidden />
                      {t('auth.sign_in', 'Sign in')}
                    </Link>
                  )
                }
              />
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
  )
}

export default Courses
