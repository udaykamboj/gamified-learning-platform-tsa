'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getCourseMetadata } from '@services/courses/courses'
import { CheckSquare, Square } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import React from 'react'
import UserAvatar from '@components/Objects/UserAvatar'
import SubjectArtwork from '@components/Objects/Thumbnails/SubjectArtwork'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/format'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

type Course = {
  course_uuid: string
  name: string
  description: string
  thumbnail_image: string
  org_id: string | number
  update_date: string
  public?: boolean
  published?: boolean
  authors?: Array<{
    user: {
      id: string
      user_uuid: string
      avatar_image: string
      first_name: string
      last_name: string
      username: string
    }
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  }>
}

type PropsType = {
  course: Course
  orgslug: string
  customLink?: string
  isDashboard?: boolean
  isSelected?: boolean
  onToggleSelect?: (_courseUuid: string) => void
  isPriority?: boolean
}

export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '')

function CourseThumbnail({ course, orgslug, customLink, isDashboard = false, isSelected = false, onToggleSelect, isPriority = false }: PropsType) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const queryClient = useQueryClient()
  const { track } = useLHAnalytics('learner')

  const cleanUuid = removeCoursePrefix(course.course_uuid)

  const handleCardOpen = () => {
    track(AnalyticsEvent.CourseCardOpened, {
      course_uuid: cleanUuid,
      source: isDashboard ? 'dashboard' : 'catalog',
    })
  }

  // Prefetch course meta on hover so the course page feels instant
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.courses.meta(cleanUuid),
      queryFn: () => getCourseMetadata(cleanUuid, {}, session?.data?.tokens?.access_token, { slim: true }),
      staleTime: 60_000,
    })
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(course.course_uuid)
  }

  const activeAuthors = course.authors?.filter(author => author.authorship_status === 'ACTIVE') || []
  const displayedAuthors = activeAuthors.slice(0, 3)
  const hasMoreAuthors = activeAuthors.length > 3
  const remainingAuthorsCount = activeAuthors.length - 3

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : null

  const courseLink = customLink ? customLink : getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)

  return (
    <div onMouseEnter={handleMouseEnter} className={`group relative flex flex-col sl-card sl-card-interactive overflow-hidden w-full ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
      {/* Selection checkbox - visible on hover or when selected (dashboard only) */}
      {isDashboard && onToggleSelect && (
        <button
          onClick={handleSelectClick}
          aria-label={isSelected ? 'Deselect course' : 'Select course'}
          className={`absolute top-2 start-2 z-20 p-1.5 bg-card/90 backdrop-blur-sm rounded-full hover:bg-card transition-all shadow-md ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-foreground" />
          ) : (
            <Square className="w-4 h-4 text-gray-500" />
          )}
        </button>
      )}

      <Link prefetch={false} href={courseLink} onClick={handleCardOpen} className="block relative aspect-video overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        {/* Hidden img gives the browser a real resource hint so it can fetch the background-image early as an LCP candidate */}
        {isPriority && thumbnailImage && (
          <img
            src={thumbnailImage}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
          />
        )}
        {thumbnailImage ? (
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${thumbnailImage})` }}
          />
        ) : (
          <SubjectArtwork seed={course.course_uuid} />
        )}
        {isDashboard && (
          <div className="absolute bottom-2 start-2">
            {course.published ? (
              <span className="px-2.5 py-0.5 text-meta font-semibold bg-success-surface text-success rounded-full">
                {t('courses.published')}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-meta font-semibold bg-warning-surface text-warning rounded-full">
                {t('courses.unpublished')}
              </span>
            )}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between">
          <Link
            prefetch={false}
            href={courseLink}
            onClick={handleCardOpen}
            className="text-card-title font-semibold text-foreground line-clamp-1 after:absolute after:inset-0 after:content-['']"
            dir="auto">
            {course.name}
          </Link>
        </div>
        
        {course.description && (
          <p className="text-ui text-muted-foreground line-clamp-2">
            {course.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            {displayedAuthors.length > 0 && (
              <div className="relative z-10 flex -space-x-2 items-center">
                {displayedAuthors.map((author, index) => (
                  <div 
                    key={author.user.user_uuid} 
                    className="relative"
                    style={{ zIndex: displayedAuthors.length - index }}
                  >
                    <UserAvatar
                      border="border-2"
                      rounded="rounded-full"
                      avatar_url={author.user.avatar_image ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image) : ''}
                      predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
                      width={20}
                      showProfilePopup={true}
                      userId={author.user.id}
                    />
                  </div>
                ))}
                {hasMoreAuthors && (
                  <div className="relative z-0">
                    <div className="flex items-center justify-center w-[20px] h-[20px] text-[11px] font-semibold text-muted-foreground bg-muted border-2 border-card rounded-full">
                      +{remainingAuthorsCount}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {course.update_date && (
              <span className="text-meta text-muted-foreground tabular-nums">
                {formatDate(course.update_date, i18n.language, { dateStyle: undefined, month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          
          <Link
            prefetch={false}
            href={courseLink}
            onClick={handleCardOpen}
            className="relative z-10 text-sm font-semibold text-link hover:underline underline-offset-4"
          >
            {t('courses.start_learning')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CourseThumbnail
