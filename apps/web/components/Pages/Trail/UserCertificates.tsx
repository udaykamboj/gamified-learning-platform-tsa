'use client'

import React from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Award, ExternalLink, Calendar, Building } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getAllUserCertificates } from '@services/courses/certifications'
import { asArray } from '@services/utils/ts/requests'
import { useTranslation } from 'react-i18next'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'

interface UserCertificatesProps {
  orgslug: string
}

const UserCertificates: React.FC<UserCertificatesProps> = ({ orgslug }) => {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const org = useOrg() as any

  const { data: certificates, error, isLoading } = useQuery({
    queryKey: queryKeys.certifications.detail(`user_all_${org?.id}`),
    queryFn: () => getAllUserCertificates(org.id, access_token),
    select: (res: any) => asArray(res),
    enabled: !!access_token && !!org?.id,
    staleTime: 60_000,
  })

  const certificatesData: any[] = certificates ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-2">
        <div className="mt-10 flex items-center gap-3 mb-4">
          <div className="grid size-10 place-items-center rounded-[10px] border border-border bg-card text-reward shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <h2 className="sl-section-title">{t('certificate.my_certificates')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sl-card overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col space-y-2">
        <div className="mt-10 flex items-center gap-3 mb-4">
          <div className="grid size-10 place-items-center rounded-[10px] border border-border bg-card text-reward shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <h2 className="sl-section-title">{t('certificate.my_certificates')}</h2>
        </div>
        <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 sl-card text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
            <Award className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-gray-500">{t('certificate.failed_load_certificates')}</p>
        </div>
      </div>
    )
  }

  if (!certificatesData || certificatesData.length === 0) {
    return (
      <div className="flex flex-col space-y-2">
        <div className="mt-10 flex items-center gap-3 mb-4">
          <div className="grid size-10 place-items-center rounded-[10px] border border-border bg-card text-reward shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <h2 className="sl-section-title">{t('certificate.my_certificates')}</h2>
        </div>
        <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 sl-card text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
            <Award className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-card-title font-semibold text-foreground mb-1">
            {t('certificate.no_certificates_earned')}
          </h1>
          <p className="text-ui text-muted-foreground mb-6 text-center max-w-md">
            {t('certificate.complete_courses_to_earn')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="mt-10 flex items-center gap-3 mb-4">
        <div className="grid size-10 place-items-center rounded-[10px] border border-border bg-card text-reward shadow-sm">
          <Award className="w-5 h-5" />
        </div>
        <h2 className="sl-section-title">{t('certificate.my_certificates')}</h2>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {certificatesData.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {certificatesData.map((certificate: any) => {
          const verificationLink = getUriWithOrg(orgslug, `/certificates/${certificate.certificate_user.user_certification_uuid}/verify`)
          const awardedDate = new Date(certificate.certificate_user.created_at).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })

          return (
            <div
              key={certificate.certificate_user.user_certification_uuid}
              className="group relative flex flex-col sl-card sl-card-interactive overflow-hidden w-full"
            >
              {/* Thumbnail */}
              <Link
                href={verificationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative aspect-video overflow-hidden bg-gradient-to-br from-yellow-50 to-amber-100"
              >
                {certificate.course?.thumbnail_image && org?.org_uuid ? (
                  <img
                    src={getCourseThumbnailMediaDirectory(
                      org.org_uuid,
                      certificate.course.course_uuid,
                      certificate.course.thumbnail_image
                    )}
                    alt={certificate.course.name}
                    className="w-full h-full object-cover opacity-60"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-3 bg-card/90 backdrop-blur-sm rounded-full shadow-lg">
                    <Award className="w-8 h-8 text-yellow-500" />
                  </div>
                </div>
              </Link>

              {/* Content */}
              <div className="p-3 flex flex-col space-y-1.5">
                <Link
                  href={verificationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-card-title font-semibold text-foreground line-clamp-1"
                >
                  {certificate.certification.config.certification_name}
                </Link>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Building className="w-3 h-3" />
                  <span className="truncate">{certificate.course.name}</span>
                </div>

                <div className="pt-1.5 flex items-center justify-between border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar size={12} />
                    <span className="text-meta font-semibold">
                      {awardedDate}
                    </span>
                  </div>

                  <Link
                    href={verificationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sl-telemetry inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  >
                    {t('certificate.verify')}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default UserCertificates 