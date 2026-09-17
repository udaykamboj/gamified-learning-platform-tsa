import React from 'react'
import * as Form from '@radix-ui/react-form'
import { BarLoader } from 'react-spinners'
import { Backpack } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { createAssignment } from '@services/courses/assignments'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createActivity, deleteActivity } from '@services/courses/activities'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { useUpgradeModal } from '@components/Dashboard/Shared/PlanRestricted/UpgradeModalContext'
import { getErrorMessage } from '@services/utils/ts/errorMessage'
import { Check, ClipboardCheck, Dumbbell, GraduationCap, Shield } from 'lucide-react'

// What this assignment is for in the student's learning path
// (docs/refactor/02-target-architecture.md). The server applies the matching
// preset: instant scoring, unlimited tries, no deadline, percentage scores.
type LearningRole = 'practice' | 'assessment'

const ROLE_OPTIONS: {
  value: LearningRole
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: 'practice',
    label: 'Practice set',
    description: 'Try, get instant feedback and answers, try again. Passes at 70%.',
    icon: <Dumbbell size={18} />,
  },
  {
    value: 'assessment',
    label: 'Unit test',
    description: 'Shows what the student has mastered. Answers unlock after scoring. Passes at 80%.',
    icon: <GraduationCap size={18} />,
  },
]

function NewAssignment({ submitActivity: _submitActivity, chapterId, course, closeModal }: any) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const queryClient = useQueryClient()
  const { track } = useLHAnalytics('dashboard')
  const { handlePlanLimit } = useUpgradeModal()
  const cleanCourseUuid = (id: string) => id?.replace(/^course_/, '') ?? id
  const [activityName, setActivityName] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activityDescription, setActivityDescription] = React.useState('')
  const [learningRole, setLearningRole] = React.useState<LearningRole>('practice')
  const [antiCopyPaste, setAntiCopyPaste] = React.useState(false)
  // Formative practice: handed in and never scored (completes on hand-in).
  const [ungraded, setUngraded] = React.useState(false)
  const isUngraded = learningRole === 'practice' && ungraded

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setIsSubmitting(true)
    const activity = {
      name: activityName,
      chapter_id: chapterId,
      activity_type: 'TYPE_ASSIGNMENT',
      activity_sub_type: 'SUBTYPE_ASSIGNMENT_ANY',
      published: false,
      course_id: course?.courseStructure.id,
      details: { learning_role: learningRole },
    }

    const activity_res = await createActivity(
      activity,
      chapterId,
      org?.id,
      session.data?.tokens?.access_token
    )
    // Scoring, retries, answer reveal and the pass mark come from the server's
    // preset for the role; only send what the author chose here.
    const res = await createAssignment(
      {
        title: activityName,
        description: activityDescription,
        grading_type: 'PERCENTAGE',
        ungraded: isUngraded,
        anti_copy_paste: antiCopyPaste,
        course_id: course?.courseStructure.id,
        org_id: org?.id,
        chapter_id: chapterId,
        activity_id: activity_res?.id,
      },
      session.data?.tokens?.access_token
    )
    const toast_loading = toast.loading(
      t('dashboard.assignments.modals.create.toasts.creating')
    )

    if (res.success) {
      toast.dismiss(toast_loading)
      toast.success(t('dashboard.assignments.modals.create.toasts.success'))
      track(AnalyticsEvent.AssignmentCreated, {
        grading_type: 'PERCENTAGE',
        auto_grading: !isUngraded,
        allow_retries: true,
        has_due_date: false,
      })
    } else {
      toast.dismiss(toast_loading)
      // Assignments are quota-limited on the free plan → offer an upgrade
      // rather than a dead-end error toast.
      if (!handlePlanLimit(res, { source: 'assignment_create', feature: 'assignments', requiredPlan: 'standard' })) {
        toast.error(getErrorMessage(res.data?.detail, t('dashboard.assignments.modals.create.toasts.error')))
      }
      await deleteActivity(
        activity_res.activity_uuid,
        session.data?.tokens?.access_token
      )
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(cleanCourseUuid(course.courseStructure.course_uuid)) })
    queryClient.invalidateQueries({ queryKey: ['courses'] })
    queryClient.invalidateQueries({ queryKey: ['assignments'] })
    setIsSubmitting(false)
    closeModal()
  }

  const inputClass =
    'w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors'

  return (
    <Form.Root onSubmit={handleSubmit} className="space-y-4">
      <div
        className="relative flex items-center justify-center h-20 rounded-xl overflow-hidden"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(253,230,138,0.25) 5px, rgba(253,230,138,0.25) 6px)',
        }}
      >
        <span className="flex items-center gap-2 bg-white nice-shadow rounded-full px-4 py-1.5 text-sm font-medium text-gray-600">
          <Backpack size={18} weight="duotone" className="text-amber-400" />
          Practice &amp; tests
        </span>
      </div>

      {/* Learning role */}
      <div className="rounded-xl nice-shadow p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">What is this for?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((option) => {
            const selected = learningRole === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLearningRole(option.value)}
                aria-pressed={selected}
                className={`relative flex flex-col items-start text-start gap-1 p-3 rounded-xl nice-shadow bg-white transition-all ${
                  selected ? 'ring-2 ring-gray-900' : 'hover:bg-gray-50/60'
                }`}
              >
                {selected && (
                  <span className="absolute top-2 end-2 w-4 h-4 rounded-full flex items-center justify-center bg-gray-900 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{option.icon}</span>
                <span className="text-xs font-bold text-gray-900">{option.label}</span>
                <span className="text-[10px] leading-snug text-gray-500">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Basic info */}
      <div className="rounded-xl nice-shadow p-4 space-y-4">
        <Form.Field name="assignment-activity-title" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            {t('dashboard.assignments.modals.create.form.title_label')}
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            {t('dashboard.assignments.modals.create.form.title_required')}
          </Form.Message>
          <Form.Control asChild>
            <input
              onChange={(e) => setActivityName(e.target.value)}
              type="text"
              required
              className={inputClass}
            />
          </Form.Control>
        </Form.Field>

        <Form.Field
          name="assignment-activity-description"
          className="space-y-1.5"
        >
          <Form.Label className="text-sm font-medium text-gray-700">
            {t('dashboard.assignments.modals.create.form.description_label')}
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            {t('dashboard.assignments.modals.create.form.description_required')}
          </Form.Message>
          <Form.Control asChild>
            <textarea
              onChange={(e) => setActivityDescription(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors resize-none"
            />
          </Form.Control>
        </Form.Field>
      </div>

      {/* Options */}
      <div className="rounded-xl nice-shadow p-4 space-y-2">
        {learningRole === 'practice' && (
          <SmallToggleRow
            icon={<ClipboardCheck size={16} className="text-teal-500" />}
            label={t('dashboard.assignments.modals.edit.form.ungraded_label', { defaultValue: 'Formative — no grading' })}
            description="Students hand their work in and compare it with a model answer. No score; completes on hand-in."
            checked={ungraded}
            onChange={setUngraded}
          />
        )}
        <SmallToggleRow
          icon={<Shield size={16} className="text-cyan-500" />}
          label={t('dashboard.assignments.modals.create.form.anti_copy_paste_label')}
          description={t('dashboard.assignments.modals.create.form.anti_copy_paste_description')}
          checked={antiCopyPaste}
          onChange={setAntiCopyPaste}
        />
      </div>

      <div className="flex justify-end">
        <Form.Submit asChild>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center h-9 px-5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('dashboard.assignments.modals.create.form.submit')
            )}
          </button>
        </Form.Submit>
      </div>
    </Form.Root>
  )
}

function SmallToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (_next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-gray-100 bg-white">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <div className="mt-0.5 flex-none">{icon}</div>
        <div className="flex flex-col min-w-0">
          <p className="text-xs font-bold text-gray-900">{label}</p>
          <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative flex-none inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-gray-900' : 'bg-gray-200 hover:bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-1 rtl:-translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default NewAssignment
