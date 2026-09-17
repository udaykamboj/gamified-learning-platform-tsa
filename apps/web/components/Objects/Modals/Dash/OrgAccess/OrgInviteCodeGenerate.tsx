import { useOrg } from '@components/Contexts/OrgContext'
import { createInviteCode } from '@services/organizations/invites'
import { Ticket } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

type OrgInviteCodeGenerateProps = {
    setInvitesModal: any
}

function OrgInviteCodeGenerate(props: OrgInviteCodeGenerateProps) {
  const { t } = useTranslation()
    const org = useOrg() as any
    const session = useLHSession() as any
    const queryClient = useQueryClient()
    const { track } = useLHAnalytics('dashboard')

    async function handleGenerate() {
        let res = await createInviteCode(org.id, session.data?.tokens?.access_token)
        if (res.status == 200) {
            track(AnalyticsEvent.InviteCodeCreated, { mode: 'normal' })
            queryClient.invalidateQueries({ queryKey: queryKeys.org.inviteCodes(org.id) })
            props.setInvitesModal(false)
        } else {
            toast.error(t('dashboard.users.signups.generate_modal.toasts.error', { status: res.status, detail: res.data.detail }))
        }
    }

    return (
        <div className='flex flex-col space-y-4 pt-2'>
            <p className='text-sm text-gray-500'>
                {t('dashboard.users.signups.generate_modal.normal_description')}
            </p>
            {/* Generate button */}
            <div className='flex justify-end pt-1'>
                <button
                    onClick={handleGenerate}
                    className='flex space-x-2 hover:cursor-pointer p-2 px-5 rounded-lg font-bold items-center text-sm transition-colors bg-green-700 text-green-100 hover:bg-green-500'
                >
                    <Ticket className="w-4 h-4" />
                    <span>{t('dashboard.users.signups.generate_modal.generate_button')}</span>
                </button>
            </div>
        </div>
    )
}

export default OrgInviteCodeGenerate
