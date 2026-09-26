'use client'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { updateFolder, getFolderById } from '@services/folders/folders'
import { updateMedia, getMediaById } from '@services/media/media-resource'
import { Check, Globe, Users } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import useSWR from 'swr'
import { useTranslation } from 'react-i18next'

type ResourceType = 'folders' | 'media'

type Props = {
  resource_uuid: string
  resourceType: ResourceType
  orgslug: string
}

const AccessCard = React.forwardRef<
  HTMLDivElement,
  {
    icon: React.ElementType
    title: string
    description: string
    selected: boolean
  } & React.HTMLAttributes<HTMLDivElement>
>(function AccessCard({ icon: Icon, title, description, selected, className, ...rest }, ref) {
  const { t } = useTranslation()
  return (
    <div
      ref={ref}
      {...rest}
      className={`
        relative w-full rounded-xl p-6 cursor-pointer select-none
        flex flex-col items-center justify-center text-center
        transition-all duration-150
        ${
          selected
            ? 'bg-white border border-indigo-200 ring-1 ring-indigo-100 shadow-xs'
            : 'bg-gray-50/80 border border-gray-100 hover:bg-gray-50 hover:border-gray-200'
        }
        ${className || ''}
      `}
      style={{ minHeight: 160 }}
    >
      {selected && (
        <div className="absolute top-3 end-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full ps-1 pe-2 py-0.5">
          <span className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
            <Check size={10} strokeWidth={3.5} className="text-white" />
          </span>
          <span>{t('access.active')}</span>
        </div>
      )}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-150 ${
          selected ? 'bg-indigo-50 text-indigo-600' : 'bg-white border border-gray-100 text-gray-400'
        }`}
      >
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div className={`mt-4 text-base sm:text-lg font-bold tracking-tight ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
        {title}
      </div>
      <div className="mt-1 text-xs sm:text-sm text-gray-400 leading-snug max-w-[420px]">{description}</div>
    </div>
  )
})

function SkeletonCard() {
  return (
    <div
      className="w-full rounded-xl bg-gray-50/80 border border-gray-100 animate-pulse flex flex-col items-center justify-center p-6"
      style={{ minHeight: 160 }}
    >
      <div className="w-12 h-12 rounded-xl bg-gray-100" />
      <div className="mt-4 h-4 w-28 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-48 rounded bg-gray-100" />
    </div>
  )
}

function ManageAccessPopover({ resource_uuid, resourceType }: Props) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  // Current public flag of the resource
  const { data: resource, mutate: mutateResource } = useSWR(
    resource_uuid && access_token ? ['resource', resourceType, resource_uuid] : null,
    async () => {
      if (resourceType === 'folders') return getFolderById(resource_uuid, access_token)
      if (resourceType === 'media') return getMediaById(resource_uuid, access_token)
      return null
    }
  )

  const { track } = useLHAnalytics('dashboard')
  const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (resource && typeof resource.public === 'boolean' && isClientPublic === undefined) {
      setIsClientPublic(resource.public)
    }
  }, [resource])

  const persistPublic = async (value: boolean) => {
    setIsSaving(true)
    try {
      if (resourceType === 'folders') {
        await updateFolder(resource_uuid, { public: value }, access_token)
      } else if (resourceType === 'media') {
        await updateMedia(resource_uuid, { public: value }, access_token)
      }
      setIsClientPublic(value)
      mutateResource()
      track(AnalyticsEvent.ResourceVisibilityChanged, {
        resource_type: resourceType,
        resource_uuid,
        is_public: value,
      })
      toast.success(t('access.visibility_updated'))
    } catch (error: any) {
      toast.error(error?.message || t('access.visibility_update_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const isReady = isClientPublic !== undefined

  return (
    <div className="bg-white rounded-xl">
      {/* Access type cards */}
      <div className="pb-5 border-b border-gray-100">
        <div className={`flex flex-col sm:flex-row gap-3 transition-opacity duration-200 ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
          {!isReady ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {isClientPublic === true ? (
                <AccessCard
                  icon={Globe}
                  title={t('access.public.title')}
                  description={t('access.public.description')}
                  selected
                />
              ) : (
                <ConfirmationModal
                  confirmationButtonText={t('access.public.confirmation_button')}
                  confirmationMessage={t('access.public.confirmation_message')}
                  dialogTitle={t('access.public.confirmation_title')}
                  dialogTrigger={
                    <AccessCard
                      icon={Globe}
                      title={t('access.public.title')}
                      description={t('access.public.description')}
                      selected={false}
                    />
                  }
                  functionToExecute={() => persistPublic(true)}
                  status="info"
                />
              )}

              {isClientPublic === false ? (
                <AccessCard
                  icon={Users}
                  title={t('access.users_only.title')}
                  description={t('access.users_only.description')}
                  selected
                />
              ) : (
                <ConfirmationModal
                  confirmationButtonText={t('access.users_only.confirmation_button')}
                  confirmationMessage={t('access.users_only.confirmation_message')}
                  dialogTitle={t('access.users_only.confirmation_title')}
                  dialogTrigger={
                    <AccessCard
                      icon={Users}
                      title={t('access.users_only.title')}
                      description={t('access.users_only.description')}
                      selected={false}
                    />
                  }
                  functionToExecute={() => persistPublic(false)}
                  status="info"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManageAccessPopover
