'use client'
import React, { useEffect, use } from 'react';
import { motion } from 'motion/react'
import { getUriWithOrg } from '@services/config/config'
import { KeyRound, ScanEye, ShieldCheck, Users } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers'
import OrgAccess from '@components/Dashboard/Pages/Users/OrgAccess/OrgAccess'
import OrgAuditLogs from '@components/Dashboard/Pages/Org/OrgAuditLogs/OrgAuditLogs'
import OrgTwoFactorPolicy from '@components/Dashboard/Pages/Users/Security/OrgTwoFactorPolicy'
import OrgSignInMethods from '@components/Dashboard/Pages/Users/Security/OrgSignInMethods'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DashTabBar, DashTabItem } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'

export type SettingsParams = {
  subpage: string
  orgslug: string
}

function UsersSettingsPage(props: { params: Promise<SettingsParams> }) {
  const { t } = useTranslation()
  const params = use(props.params);
  const [H1Label, setH1Label] = React.useState('')
  const [H2Label, setH2Label] = React.useState('')

  function handleLabels() {
    if (params.subpage == 'users') {
      setH1Label(t('dashboard.users.settings.pages.users.title'))
      setH2Label(t('dashboard.users.settings.pages.users.subtitle'))
    }
    if (params.subpage == 'signups') {
      setH1Label(t('dashboard.users.settings.pages.signups.title'))
      setH2Label(t('dashboard.users.settings.pages.signups.subtitle'))
    }
    if (params.subpage == 'audit-logs') {
      setH1Label(t('dashboard.users.settings.pages.audit_logs.title'))
      setH2Label(t('dashboard.users.settings.pages.audit_logs.subtitle'))
    }
    if (params.subpage == 'two-factor') {
      setH1Label(t('dashboard.users.settings.pages.two_factor.title', { defaultValue: 'Two-factor' }))
      setH2Label(t('dashboard.users.settings.pages.two_factor.subtitle', {
        defaultValue: 'Require two-factor authentication for members of this organization',
      }))
    }
    if (params.subpage == 'sign-in') {
      setH1Label(t('dashboard.users.settings.pages.sign_in.title', { defaultValue: 'Sign-in' }))
      setH2Label(t('dashboard.users.settings.pages.sign_in.subtitle', {
        defaultValue: 'Choose how members are allowed to sign in to this organization',
      }))
    }
  }

  useEffect(() => {
    handleLabels()
  }, [params.subpage, params, t])

  const tabs: DashTabItem[] = [
    {
      key: 'users',
      label: t('dashboard.users.settings.tabs.users'),
      icon: <Users size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/users`,
      active: params.subpage === 'users',
    },
    {
      key: 'signups',
      label: t('dashboard.users.settings.tabs.signups'),
      icon: <ScanEye size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/signups`,
      active: params.subpage === 'signups',
    },
    {
      key: 'sign-in',
      label: t('dashboard.users.settings.tabs.sign_in', { defaultValue: 'Sign-in' }),
      icon: <KeyRound size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/sign-in`,
      active: params.subpage === 'sign-in',
    },
    {
      key: 'two-factor',
      label: t('dashboard.users.settings.tabs.two_factor', { defaultValue: 'Two-factor' }),
      icon: <ShieldCheck size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/two-factor`,
      active: params.subpage === 'two-factor',
    },
    {
      key: 'audit-logs',
      label: t('dashboard.users.settings.tabs.audit_logs'),
      icon: <ShieldAlert size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/users/settings/audit-logs`,
      active: params.subpage === 'audit-logs',
      requiresPlan: 'enterprise',
    },
  ]

  return (
    <div className="h-screen w-full bg-[#f8f8f8] grid grid-rows-[auto_1fr] grid-cols-1 overflow-hidden">
      <div className="ps-4 pe-4 sm:ps-10 sm:pe-10 tracking-tight bg-[#fcfbfc] z-10 nice-shadow flex-shrink-0 relative">
        <div className="pt-6 pb-4">
          <Breadcrumbs items={[
            { label: t('common.users'), href: '/dash/users/settings/users', icon: <Users size={14} /> }
          ]} />
        </div>
        <div className="my-2 py-3">
          <div className="w-full flex flex-col space-y-1 min-w-0">
            <div className="pt-3 flex font-bold text-3xl sm:text-4xl tracking-tighter truncate">
              {H1Label}
            </div>
            <div className="flex font-medium text-gray-400 text-md truncate">
              {H2Label}
            </div>
          </div>
        </div>
        <DashTabBar tabs={tabs} />
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="min-w-0 overflow-y-auto overflow-x-hidden"
      >
        {params.subpage == 'users' ? <OrgUsers /> : ''}
        {params.subpage == 'signups' ? <OrgAccess /> : ''}
        {params.subpage == 'audit-logs' ? <><div className="h-6"></div><OrgAuditLogs /></> : ''}
        {params.subpage == 'sign-in' ? <><div className="h-6"></div><OrgSignInMethods /></> : ''}
        {params.subpage == 'two-factor' ? <><div className="h-6"></div><OrgTwoFactorPolicy /></> : ''}
      </motion.div>
    </div>
  )
}

export default UsersSettingsPage
