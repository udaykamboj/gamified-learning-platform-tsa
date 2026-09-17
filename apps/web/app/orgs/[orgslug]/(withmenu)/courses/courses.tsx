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
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
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
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('courses.courses')} type="cou" />
          </div>

          {/* Search */}
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
                  className="w-full ps-10 pe-10 py-2.5 bg-card nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
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

            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-2 text-sm text-gray-500 ">
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
                <Search className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  {t('courses.no_search_results')}
                </h2>
                <p className="text-gray-400 ">
                  {t('courses.try_different_search')}
                </p>
              </div>
            )}
            {allCourses.length === 0 && !searchQuery && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30 ">
                <div className="p-4 bg-card rounded-full nice-shadow mb-4">
                  {isAuthenticated ? (
                    <BookCopy className="w-8 h-8 text-gray-300 " strokeWidth={1.5} />
                  ) : (
                    <LogIn className="w-8 h-8 text-gray-300 " strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-xl font-bold text-gray-600 mb-2">
                  {isAuthenticated
                    ? t('courses.no_courses')
                    : t('courses.sign_in_to_see_courses', 'Log in to see your courses')}
                </h1>
                <p className="text-md text-gray-400 mb-6 text-center max-w-xs">
                  {!isAuthenticated ? (
                    t(
                      'courses.sign_in_to_see_courses_description',
                      'Courses in this academy may only be visible once you are signed in.',
                    )
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
                    className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary transition-colors"
                  >
                    <LogIn size={16} />
                    {t('auth.sign_in', 'Sign in')}
                  </Link>
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
  )
}

export default Courses
