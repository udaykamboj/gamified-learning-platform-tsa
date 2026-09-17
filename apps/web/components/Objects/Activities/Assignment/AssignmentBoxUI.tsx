import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext'
import { useAssignmentSubmission } from '@components/Contexts/Assignments/AssignmentSubmissionContext'
import { useAssignmentDirtyTasks } from '@components/Contexts/Assignments/AssignmentDirtyTasksContext'
import { useAutoSave, type SaveResult } from './useAutoSave'
import { BookPlus, BookUser, Check, Code2, FileUp, ListTodo, Loader2, MessageSquare, Save, TriangleAlert, Type } from 'lucide-react'
import React from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'

// Options passed to a task's submitFC. `silent` suppresses user-facing toasts
// so background auto-saves and the submit-time flush don't spam the learner.
export type TaskSubmitOptions = { silent?: boolean }

type AssignmentBoxProps = {
    type: 'quiz' | 'file' | 'form' | 'code'
    view?: 'teacher' | 'student' | 'grading' | 'custom-grading'
    maxPoints?: number
    currentPoints?: number
    currentFeedback?: string
    saveFC?: () => void
    // A task may return 'blocked' to mean "refused by policy, do not retry"
    // (e.g. a code task gated on passing its tests). useAutoSave treats that as
    // terminal instead of looping a doomed save forever.
    submitFC?: (_opts?: TaskSubmitOptions) => void | Promise<SaveResult | void>
    gradeFC?: () => void
    gradeCustomFC?: (_grade: number, _feedback?: string) => void
    autoGradable?: boolean
    // Canonical serialization of the learner's CURRENT answer and the LAST-SAVED
    // baseline. Auto-save fires whenever they differ (student tasks only).
    dirtyValue?: string
    savedValue?: string
    // Identifies this task in the dirty-task registry so "Submit for grading"
    // can flush its unsaved answers. Omit outside the learner activity flow.
    taskUUID?: string
    children: React.ReactNode
}

// Strings the system writes automatically when no teacher comment is provided.
// We treat these as "no real feedback" so we don't pre-fill the textarea with
// them on subsequent grading passes.
const isAutoFeedback = (s?: string) =>
    !!s && (/^Auto graded by system$/.test(s) || /^Graded by teacher : @/.test(s))

function AssignmentBoxUI({ type, view, currentPoints, currentFeedback, maxPoints, saveFC, submitFC, gradeFC, gradeCustomFC, autoGradable, dirtyValue, savedValue, taskUUID, children }: AssignmentBoxProps) {
    const { t } = useTranslation()
    // Grading view manual input. Pre-filled from the server-side currentPoints
    // so teachers can tweak an existing grade instead of retyping it.
    const [manualGrade, setManualGrade] = React.useState<string>('')
    const [manualFeedback, setManualFeedback] = React.useState<string>('')
    const submission = useAssignmentSubmission() as any
    const assignmentCtx = useAssignments() as any
    const session = useLHSession() as any

    // A formative assignment carries no grade at all — the API refuses to grade
    // it — so every scoring affordance in this box is hidden rather than left
    // wired to an endpoint that 400s. One check here covers the learner view,
    // the teacher view and both grading views for all six task types.
    const isUngraded = !!assignmentCtx?.assignment_object?.ungraded

    // The student can save/draft answers until they SUBMIT for grading or are
    // GRADED. A retry flips the row back to PENDING, which re-enables saving.
    const latestSubmissionStatus =
        Array.isArray(submission) && submission.length > 0
            ? submission[0]?.submission_status
            : null
    const canStudentSave =
        latestSubmissionStatus !== 'SUBMITTED' && latestSubmissionStatus !== 'GRADED'

    // Value-driven auto-save. "Dirty" is a pure content predicate
    // (dirtyValue !== savedValue) so it is immune to query refetches, window
    // focus, submission-status churn, and unrelated re-renders — the failure
    // modes of the previous flag+poller design.
    const autoSaveEnabled = view === 'student' && !!taskUUID && !!submitFC && canStudentSave
    const auto = useAutoSave({
        currentValue: dirtyValue ?? '',
        savedValue: savedValue ?? '',
        save: (opts) => (submitFC ? submitFC(opts) : Promise.resolve(true)),
        enabled: autoSaveEnabled,
    })

    // Register this student task so a single "Submit for grading" click flushes
    // its unsaved answers before the server auto-grades. Backed by the hook's
    // own dirty/flush, read via refs to avoid stale closures.
    const dirtyTasks = useAssignmentDirtyTasks()
    const flushRef = React.useRef(auto.flush)
    const getDirtyRef = React.useRef(auto.getIsDirty)
    React.useEffect(() => { flushRef.current = auto.flush; getDirtyRef.current = auto.getIsDirty })
    React.useEffect(() => {
        if (view !== 'student' || !taskUUID) return
        dirtyTasks.register(taskUUID, {
            getIsDirty: () => getDirtyRef.current(),
            flush: () => flushRef.current(),
        })
        return () => dirtyTasks.unregister(taskUUID)
    }, [view, taskUUID, dirtyTasks])

    React.useEffect(() => {
        if (currentPoints !== undefined && currentPoints !== null) {
            setManualGrade(String(currentPoints))
        }
    }, [currentPoints])

    React.useEffect(() => {
        if (currentFeedback && !isAutoFeedback(currentFeedback)) {
            setManualFeedback(currentFeedback)
        }
    }, [currentFeedback])

    const submitManualGrade = () => {
        if (!gradeCustomFC) return
        const parsed = parseInt(manualGrade, 10)
        if (Number.isNaN(parsed)) return
        const trimmed = manualFeedback.trim()
        gradeCustomFC(parsed, trimmed.length > 0 ? trimmed : undefined)
    }

    const isGradingMode = (view === 'grading' || view === 'custom-grading') && !isUngraded

    // Check if user is authenticated
    const isAuthenticated = session?.status === 'authenticated'

    return (
        <div className='flex flex-col px-4 sm:px-6 py-4 rounded-xl border border-border bg-muted/40'>
            <div className='flex flex-col sm:flex-row sm:justify-between sm:space-x-2 pb-3 text-muted-foreground sm:items-center'>
                {/* Left side with type and badges */}
                <div className='flex flex-wrap gap-2 items-center mb-2 sm:mb-0'>
                    <div className='text-card-title font-semibold text-foreground [&_svg]:text-muted-foreground'>
                        {type === 'quiz' &&
                            <div className='flex space-x-1.5 items-center'>
                                <ListTodo size={17} />
                                <p>{t('activities.quiz')}</p>
                            </div>}
                        {type === 'file' &&
                            <div className='flex space-x-1.5 items-center'>
                                <FileUp size={17} />
                                <p>{t('activities.file_submission')}</p>
                            </div>}
                        {type === 'form' &&
                            <div className='flex space-x-1.5 items-center'>
                                <Type size={17} />
                                <p>{t('activities.form')}</p>
                            </div>}
                        {type === 'code' &&
                            <div className='flex space-x-1.5 items-center'>
                                <Code2 size={17} />
                                <p>{t('activities.code')}</p>
                            </div>}
                    </div>

                    {view === 'teacher' &&
                        <div className='sl-badge sl-badge-warning'>
                            <BookUser size={12} />
                            <p>{t('activities.teacher_view')}</p>
                        </div>
                    }
                    {maxPoints && !isUngraded &&
                        <div className='sl-badge sl-badge-success'>
                            <BookPlus size={12} />
                            <p>{maxPoints} {t('assignments.points')}</p>
                        </div>
                    }
                </div>

                {/* Right side with buttons and actions */}
                <div className='flex flex-wrap gap-2 items-center'>
                    {/* Auto-save status — answers persist automatically. */}
                    {autoSaveEnabled && (auto.isDirty || auto.status !== 'idle') && (
                        <div className='flex gap-1.5 items-center font-medium px-2 py-1 text-meta text-muted-foreground sm:me-2'>
                            {auto.isBlocked ? (
                                // Refused by policy, not a transient failure — no retry
                                // is coming, so promising one would be a lie. The task
                                // itself explains what needs to change (e.g. tests must
                                // pass before the answer can be saved).
                                <>
                                    <TriangleAlert size={13} className='text-error' />
                                    <p className='text-error'>{t('activities.autosave_blocked', { defaultValue: "Can't be saved yet" })}</p>
                                </>
                            ) : auto.isError ? (
                                // Failed save: show a distinct indicator (a retry
                                // is already scheduled) instead of a stuck spinner.
                                <>
                                    <TriangleAlert size={13} className='text-warning' />
                                    <p className='text-warning'>{t('activities.autosave_retry', { defaultValue: "Couldn't save — retrying…" })}</p>
                                </>
                            ) : auto.isSaving ? (
                                <>
                                    <Loader2 size={13} className='animate-spin' />
                                    <p>{t('activities.autosaving', { defaultValue: 'Saving…' })}</p>
                                </>
                            ) : (auto.isPending || auto.isDirty) ? (
                                // Debounce timer armed but no request in flight. Showing
                                // a spinner + "Saving…" here claimed work that had not
                                // started, which is exactly when an unmount lost it.
                                <>
                                    <TriangleAlert size={13} className='text-muted-foreground' />
                                    <p>{t('activities.autosave_unsaved', { defaultValue: 'Unsaved changes' })}</p>
                                </>
                            ) : (
                                <>
                                    <Check size={13} className='text-success' />
                                    <p>{t('activities.autosaved', { defaultValue: 'Saved' })}</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Teacher button */}
                    {view === 'teacher' &&
                        <button
                            type='button'
                            onClick={() => saveFC && saveFC()}
                            className='sl-btn sl-btn-secondary sl-btn-sm'>
                            <Save size={14} aria-hidden />
                            {t('common.save')}
                        </button>
                    }

                    {/* Student button - only show if authenticated and not yet submitted/graded.
                        Routed through the auto-save hook so a manual click can't race a
                        background save into a duplicate submission; disabled while saving. */}
                    {view === 'student' && isAuthenticated && canStudentSave &&
                        <button
                            type='button'
                            onClick={() => { if (!auto.isSaving) auto.saveNow() }}
                            aria-busy={auto.isSaving}
                            className={`sl-btn sl-btn-secondary sl-btn-sm w-full sm:w-auto ${auto.isSaving ? 'opacity-60 cursor-wait' : ''}`}>
                            <Save size={14} aria-hidden />
                            {t('activities.save_answers', { defaultValue: 'Save answers' })}
                        </button>
                    }

                    {/* Grading controls — shared between 'grading' and 'custom-grading' views */}
                    {isGradingMode && maxPoints !== undefined && gradeCustomFC && (
                        <div className='flex flex-wrap sm:flex-nowrap w-full sm:w-auto px-0.5 py-0.5 rounded-md gap-2 sm:space-x-2 items-center'>
                            {currentPoints !== undefined && currentPoints > 0 && (
                                <p className='sl-badge sl-badge-success'>{currentPoints}/{maxPoints} {t('assignments.points')}</p>
                            )}
                            <div className='flex items-center gap-1'>
                                <button
                                    type='button'
                                    onClick={() => setManualGrade(String(maxPoints))}
                                    className='sl-badge sl-badge-success cursor-pointer hover:opacity-80'>
                                    {t('assignments.quick_grade.full', { defaultValue: 'Full' })}
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setManualGrade(String(Math.round(maxPoints / 2)))}
                                    className='sl-badge sl-badge-warning cursor-pointer hover:opacity-80'>
                                    {t('assignments.quick_grade.half', { defaultValue: 'Half' })}
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setManualGrade('0')}
                                    className='sl-badge sl-badge-error cursor-pointer hover:opacity-80'>
                                    {t('assignments.quick_grade.zero', { defaultValue: 'Zero' })}
                                </button>
                            </div>
                            <div className='flex items-center gap-1.5'>
                                <input
                                    value={manualGrade}
                                    onChange={(e) => setManualGrade(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submitManualGrade()
                                    }}
                                    placeholder={`/${maxPoints}`}
                                    min={0}
                                    max={maxPoints}
                                    className='sl-input w-24 text-sm'
                                    type='number'
                                />
                                <button
                                    type='button'
                                    onClick={submitManualGrade}
                                    className='sl-btn sl-btn-primary sl-btn-sm'>
                                    <BookPlus size={14} aria-hidden />
                                    {t('assignments.grade')}
                                </button>
                            </div>
                            {view === 'grading' && gradeFC && (
                                <button
                                    type='button'
                                    onClick={() => gradeFC && gradeFC()}
                                    className='sl-btn sl-btn-secondary sl-btn-sm'>
                                    <BookPlus size={14} aria-hidden />
                                    {autoGradable ? t('assignments.run_autograde') : t('assignments.grade')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Per-task feedback — saved together with the manual grade. */}
            {isGradingMode && gradeCustomFC && (
                <div className='flex items-start gap-2 mb-3 px-1'>
                    <MessageSquare size={14} className='text-muted-foreground mt-3 flex-none' />
                    <textarea
                        value={manualFeedback}
                        onChange={(e) => setManualFeedback(e.target.value)}
                        placeholder={t('assignments.task_feedback_placeholder', { defaultValue: 'Note for this task (saved with grade)' })}
                        rows={1}
                        className='sl-input w-full text-sm resize-y'
                    />
                </div>
            )}

            {children}
        </div>
    )
}

export default AssignmentBoxUI
