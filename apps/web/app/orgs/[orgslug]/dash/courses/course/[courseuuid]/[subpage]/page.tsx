'use client'
import React, { use } from 'react';
import { CourseProvider } from '../../../../../../../../components/Contexts/CourseContext'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import { motion } from 'motion/react'
import { Info } from 'lucide-react'
import { ChartBar } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config';
import { useTranslation } from 'react-i18next';
import { PlanLevel } from '@services/plans/plans';
import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate';
import CourseAnalyticsTab from '@components/Dashboard/Analytics/Course/CourseAnalyticsTab';
import CourseMonitoringOverview from '@components/Dashboard/Pages/Course/CourseMonitoringOverview';
import { DashTabBar, DashTabItem } from '@components/Dashboard/Shared/DashTabBar/DashTabBar';

export type CourseOverviewParams = {
  orgslug: string
  courseuuid: string
  subpage: string
}

// Course monitoring for admins. Courses are platform content: there is no
// general/content/access/contributors editing (docs/refactor/progress/00-requirements.md, R6, R20).
function CourseOverviewPage(props: { params: Promise<CourseOverviewParams> }) {
  const { t } = useTranslation()
  const params = use(props.params);
  const courseuuid = `course_${params.courseuuid}`

  const tabs = [
    {
      key: 'overview',
      label: 'Overview',
      icon: Info,
      href: `/dash/courses/course/${params.courseuuid}/overview`,
    },
    {
      key: 'analytics',
      label: t('dashboard.courses.settings.tabs.analytics'),
      icon: ChartBar,
      href: `/dash/courses/course/${params.courseuuid}/analytics`,
      requiresPlan: 'pro' as PlanLevel,
    },
  ]
  const subpage = params.subpage === 'analytics' ? 'analytics' : 'overview'

  return (
    <div className="h-screen w-full bg-[#f8f8f8] grid grid-rows-[auto_1fr] grid-cols-1">
      <CourseProvider courseuuid={courseuuid} withUnpublishedActivities={true}>
        <div className="ps-4 pe-4 sm:ps-10 sm:pe-10 text-sm tracking-tight bg-[#fcfbfc] z-10 nice-shadow relative min-w-0 overflow-hidden">
          <CourseOverviewTop params={params} />
          <DashTabBar tabs={tabs.map((tab) => {
            const IconComponent = tab.icon
            return {
              key: tab.key,
              label: tab.label,
              icon: <IconComponent size={16} />,
              href: getUriWithOrg(params.orgslug, '') + tab.href,
              active: subpage === tab.key,
              requiresPlan: tab.requiresPlan,
            } as DashTabItem
          })} />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
          className="h-full overflow-y-auto overflow-x-hidden"
        >
          {subpage === 'overview' && <CourseMonitoringOverview />}
          {subpage === 'analytics' && (
            <FeatureGate feature="course_analytics">
              <CourseAnalyticsTab courseUUID={courseuuid} />
            </FeatureGate>
          )}
        </motion.div>
      </CourseProvider>
    </div>
  )
}

export default CourseOverviewPage
