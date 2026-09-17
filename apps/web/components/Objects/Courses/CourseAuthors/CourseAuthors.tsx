import React from 'react'
import UserAvatar from '../../UserAvatar'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { useMediaQuery } from 'usehooks-ts'
import { Rss, TentTree } from 'lucide-react'
import { useCourse } from '@components/Contexts/CourseContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

dayjs.extend(relativeTime)

interface Author {
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
}

interface CourseAuthorsProps {
  authors: Author[]
}

const MultipleAuthors = ({ authors, isMobile }: { authors: Author[], isMobile: boolean }) => {
  const { t } = useTranslation()
  const displayedAvatars = authors.slice(0, 3)
  const displayedNames = authors.slice(0, 2)
  const remainingCount = Math.max(0, authors.length - 3)
  
  // Consistent sizes for both avatars and badge
  const avatarSize = isMobile ? 72 : 86
  const borderSize = "border-4"

  return (
    <div className="flex flex-col items-center space-y-4 px-2 py-2">
      <div className="text-sm font-semibold text-muted-foreground self-start">{t('courses.authors_and_updates')} </div>
      
      {/* Avatars row */}
      <div className="flex justify-center -space-x-6 relative">
        {displayedAvatars.map((author, index) => (
          <div
            key={author.user.user_uuid}
            className="relative"
            style={{ zIndex: displayedAvatars.length - index }}
          >
            <div className="ring-white">
              <UserAvatar
                border={borderSize}
                rounded='rounded-full'
                avatar_url={author.user.avatar_image ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image) : ''}
                predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
                width={avatarSize}
                showProfilePopup={true}
                userId={author.user.id}
              />
            </div>
          </div>
        ))}
        {remainingCount > 0 && (
          <div 
            className="relative"
            style={{ zIndex: 0 }}
          >
            <div 
              className="flex items-center justify-center bg-neutral-100 text-neutral-600 font-medium rounded-full border-4 border-white shadow-sm"
              style={{ 
                width: `${avatarSize}px`, 
                height: `${avatarSize}px`,
                fontSize: isMobile ? '14px' : '16px'
              }}
            >
              +{remainingCount}
            </div>
          </div>
        )}
      </div>

      {/* Names row - improved display logic */}
      <div className="text-center mt-2">
        <div className="text-sm font-medium text-neutral-800">
          {authors.length === 1 ? (
            <span>
              {authors[0].user.first_name && authors[0].user.last_name
                ? `${authors[0].user.first_name} ${authors[0].user.last_name}`
                : `@${authors[0].user.username}`}
            </span>
          ) : (
            <>
              {displayedNames.map((author, index) => (
                <span key={author.user.user_uuid}>
                  {author.user.first_name && author.user.last_name
                    ? `${author.user.first_name} ${author.user.last_name}`
                    : `@${author.user.username}`}
                  {index === 0 && authors.length > 1 && index < displayedNames.length - 1 && " & "}
                </span>
              ))}
              {authors.length > 2 && (
                <span className="text-neutral-500 ms-1">
                  & {t('courses.and_x_more', { count: authors.length - 2 })}
                </span>
              )}
            </>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {authors.length === 1 ? (
            <span>@{authors[0].user.username}</span>
          ) : (
            <>
              {displayedNames.map((author, index) => (
                <span key={author.user.user_uuid}>
                  @{author.user.username}
                  {index === 0 && authors.length > 1 && index < displayedNames.length - 1 && " & "}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const UpdatesSection = () => {
  const { t } = useTranslation()
  const course = useCourse() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const courseUuid = course?.courseStructure?.course_uuid
  const { data: updates } = useQuery({
    queryKey: queryKeys.courses.updates(courseUuid),
    queryFn: () => apiFetch(`${getAPIUrl()}courses/${courseUuid}/updates`, access_token),
    enabled: !!(courseUuid && access_token),
    staleTime: 60_000,
  })

  return (
    <div className="mt-2 pt-2">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Rss size={14} className="text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-600">{t('courses.course_updates')}</span>
          </div>
          {updates && updates.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-500 rounded-full">
              {updates.length} {updates.length === 1 ? t('courses.update') : t('courses.updates')}
            </span>
          )}
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div className="max-h-[300px] overflow-y-auto pe-1 -me-1">
          <UpdatesListView />
        </div>
      </motion.div>
    </div>
  )
}

const UpdatesListView = () => {
  const { t } = useTranslation()
  const course = useCourse() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const courseUuid = course?.courseStructure?.course_uuid
  const { data: updates } = useQuery({
    queryKey: queryKeys.courses.updates(courseUuid),
    queryFn: () => apiFetch(`${getAPIUrl()}courses/${courseUuid}/updates`, access_token),
    enabled: !!(courseUuid && access_token),
    staleTime: 60_000,
  })

  if (!updates || updates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200">
        <TentTree size={28} className="text-neutral-400 mb-2" />
        <p className="text-sm text-neutral-600 font-medium">{t('courses.no_updates_yet')}</p>
        <p className="text-xs text-neutral-400 mt-1">{t('courses.no_updates_desc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {updates.map((update: any) => (
        <motion.div
          key={update.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="group p-3 rounded-lg bg-neutral-50/50 hover:bg-neutral-100/80 transition-colors duration-150"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-baseline space-x-2">
                <h4 className="text-sm font-medium text-neutral-800 truncate">{update.title}</h4>
                <span
                  title={dayjs(update.creation_date).format('MMMM D, YYYY')}
                  className="text-[11px] font-medium text-neutral-400 whitespace-nowrap"
                >
                  {dayjs(update.creation_date).fromNow()}
                </span>
              </div>
              <p className="text-sm text-neutral-600 line-clamp-3">{update.content}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const CourseAuthors = ({ authors }: CourseAuthorsProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Filter active authors and sort by role priority
  const sortedAuthors = [...authors]
    .filter(author => author.authorship_status === 'ACTIVE')
    .sort((a, b) => {
      const rolePriority: Record<string, number> = {
        'CREATOR': 0,
        'MAINTAINER': 1,
        'CONTRIBUTOR': 2,
        'REPORTER': 3
      };
      return rolePriority[a.authorship] - rolePriority[b.authorship];
    });

  return (
    <div className="antialiased">
      {sortedAuthors.length > 0 && <MultipleAuthors authors={sortedAuthors} isMobile={isMobile} />}
      <UpdatesSection />
    </div>
  )
}

export default CourseAuthors 