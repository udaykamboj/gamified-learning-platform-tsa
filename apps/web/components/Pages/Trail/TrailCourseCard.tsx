'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { removeCourse } from '@services/courses/activity'
import { getCourseMetadata } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { revalidateTags } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUserCertificates } from '@services/courses/certifications'
import { useCourseCertification } from '@components/Hooks/useCourseCertification'
import Link from 'next/link'
import SubjectArtwork from '@components/Objects/Thumbnails/SubjectArtwork'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { Award, ExternalLink, MoreVertical, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"

interface TrailCourseCardProps {
  course: any
  run: any
  orgslug: string
}

function TrailCourseCard(props: TrailCourseCardProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const courseid = props.course.course_uuid.replace('course_', '')
  const course = props.course
  const router = useRouter()
  const course_total_steps = props.run.course_total_steps
  const course_completed_steps = props.run.steps.length
  const orgID = org?.id
  const course_progress = course_total_steps > 0
    ? Math.round((course_completed_steps / course_total_steps) * 100)
    : 0

  const [courseCertificate, setCourseCertificate] = useState<any>(null)
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false)
  const queryClient = useQueryClient()

  // Only a definitive "this course has no certification" hides the certificate
  // row; a pending or failed lookup keeps the existing behaviour. Asked for only
  // at 100% — that is the only progress where anything below consumes it, and a
  // trail of N unfinished courses must not fire N certification requests.
  const {
    isEnabled: certificationEnabled,
    isUnknown: certificationUnknown,
    isLoading: isLoadingCertificationStatus,
  } = useCourseCertification(
    course_progress === 100 ? props.course.course_uuid : undefined
  )
  const showCertificateUI = certificationEnabled || certificationUnknown

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.courses.meta(courseid),
      queryFn: () => getCourseMetadata(courseid, {}, access_token, { slim: true }),
      staleTime: 60_000,
    })
  }

  async function quitCourse(course_uuid: string) {
    let activity = await removeCourse(course_uuid, props.orgslug, access_token)
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    if (orgID) {
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(orgID) })
    }
  }

  useEffect(() => {
    const fetchCourseCertificate = async () => {
      if (!access_token || course_progress < 100 || !org?.id) return;
      if (isLoadingCertificationStatus || !showCertificateUI) return;

      setIsLoadingCertificate(true);
      try {
        const result = await getUserCertificates(
          props.course.course_uuid,
          org.id,
          access_token
        );

        if (result.success && result.data && result.data.length > 0) {
          setCourseCertificate(result.data[0]);
        }
      } catch (error) {
        console.error('Error fetching course certificate:', error);
      } finally {
        setIsLoadingCertificate(false);
      }
    };

    fetchCourseCertificate();
  }, [access_token, course_progress, props.course.course_uuid, org?.id, isLoadingCertificationStatus, showCertificateUI]);

  useEffect(() => { }, [props.course, org])

  const courseLink = getUriWithOrg(props.orgslug, '/course/' + courseid)

  return (
    <div className="group relative flex flex-col sl-card sl-card-interactive overflow-hidden w-full" onMouseEnter={handleMouseEnter}>
      {/* Dropdown Menu */}
      <div className="absolute top-2 end-2 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 bg-card/90 backdrop-blur-sm rounded-full hover:bg-card transition-all shadow-md">
              <MoreVertical size={18} className="text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationMessage={t('courses.quit_course_confirm')}
                confirmationButtonText={t('courses.quit_course')}
                dialogTitle={t('courses.quit_course_title')}
                dialogTrigger={
                  <button className="w-full text-start flex items-center gap-2 min-h-9 px-2.5 py-2 text-sm rounded-[6px] transition-colors cursor-pointer text-error hover:bg-error-surface">
                    <Trash2 className="me-2 h-4 w-4" /> {t('courses.quit_course')}
                  </button>
                }
                functionToExecute={() => quitCourse(course.course_uuid)}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Thumbnail */}
      <Link
        href={courseLink}
        className="block relative aspect-video overflow-hidden bg-muted"
      >
        {props.course.thumbnail_image && org?.org_uuid ? (
          <img
            src={getCourseThumbnailMediaDirectory(
              org.org_uuid,
              props.course.course_uuid,
              props.course.thumbnail_image
            )}
            alt={course.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <SubjectArtwork seed={props.course.course_uuid} />
        )}
        {/* Progress overlay */}
        <div className="absolute bottom-0 start-0 end-0 h-1.5 bg-black/30" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={course_progress} aria-label={`${course.name} progress`}>
          <div
            className="h-full bg-primary"
            style={{ width: `${course_progress}%` }}
          />
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link
          href={courseLink}
          className="text-card-title font-semibold text-foreground line-clamp-1"
        >
          {course.name}
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums text-link">
            {course_progress}%
          </span>
          <span className="text-meta text-muted-foreground">
            {t('courses.completed_of', { completed: course_completed_steps, total: course_total_steps })}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          {/* Certificate or Progress indicator */}
          {course_progress === 100 ? (
            showCertificateUI && (isLoadingCertificate || isLoadingCertificationStatus) ? (
              <div className="flex items-center gap-1.5 text-gray-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-500"></div>
                <span className="text-meta font-semibold">{t('common.loading')}</span>
              </div>
            ) : showCertificateUI && courseCertificate ? (
              <div className="flex items-center gap-1.5 text-reward">
                <Award size={12} />
                <span className="text-meta font-semibold">{t('certificate.certificate')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-success">
                <Award size={12} />
                <span className="text-meta font-semibold">{t('common.completed')}</span>
              </div>
            )
          ) : (
            <span className="text-meta text-muted-foreground">{t('courses.course_progress')}</span>
          )}

          {course_progress === 100 && showCertificateUI && courseCertificate ? (
            <Link
              href={getUriWithOrg(props.orgslug, `/certificates/${courseCertificate.certificate_user.user_certification_uuid}/verify`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline underline-offset-4"
            >
              {t('certificate.verify')}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <Link
              href={courseLink}
              className="text-sm font-semibold text-link hover:underline underline-offset-4"
            >
              {t('courses.continue_learning')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default TrailCourseCard
