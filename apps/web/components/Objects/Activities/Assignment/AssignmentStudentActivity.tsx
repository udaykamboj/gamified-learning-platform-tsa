import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext';
import { useAssignmentSubmission, useAssignmentTaskSubmissions } from '@components/Contexts/Assignments/AssignmentSubmissionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAssignmentSolutionFileDir, getTaskRefFileDir } from '@services/media/media';
import TaskFileObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskFileObject';
import TaskQuizObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskQuizObject'
import TaskFormObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskFormObject'
import TaskCodeObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskCodeObject'
import TaskShortAnswerObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskShortAnswerObject'
import TaskNumberAnswerObject from '@components/Objects/Activities/Assignment/TaskTypes/TaskNumberAnswerObject'
import toast from 'react-hot-toast';
import { AlarmClockOff, Backpack, BookOpenCheck, Calendar, CheckCircle2, ClipboardCheck, Download, Info, Lock, MessageSquare, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next';

type ParsedDueDate = { at: Date; hasTime: boolean }

// Parse the assignment due date the SAME way the server does in
// `_is_assignment_past_due` (apps/api/.../assignments.py):
//   - the value is a free-form ISO-ish string; unparseable/empty means "no
//     deadline" so a malformed value never locks a student out,
//   - the server compares against a NAIVE `datetime.now()` and drops any
//     timezone offset, so the wall-clock parts are what matter. We therefore
//     build a LOCAL Date from those parts instead of letting `new Date(...)`
//     treat a bare "2026-06-12" as UTC midnight — that shift alone could mark
//     an assignment overdue a day early (or late) depending on the viewer's
//     offset, disagreeing with the 403 the server actually enforces.
export function parseDueDate(raw?: string | null): ParsedDueDate | null {
  if (!raw || !String(raw).trim()) return null
  const value = String(raw).trim()
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return null
  const [, year, month, day, hours, minutes, seconds] = match
  const hasTime = hours !== undefined
  const at = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours ?? 0),
    Number(minutes ?? 0),
    Number(seconds ?? 0)
  )
  if (Number.isNaN(at.getTime())) return null
  return { at, hasTime }
}

// Exported so the "Submit for grading" affordance (rendered outside this
// component) can gate on the exact same rule instead of re-deriving it.
export function isAssignmentPastDue(raw?: string | null, now: number = Date.now()): boolean {
  const parsed = parseDueDate(raw)
  if (!parsed) return false
  const cutoff = new Date(parsed.at)
  // A date-only deadline means "end of that day" server-side (the cutoff is
  // shifted to the following midnight), so the due date itself is still on time.
  if (!parsed.hasTime) cutoff.setDate(cutoff.getDate() + 1)
  return cutoff.getTime() < now
}

function AssignmentStudentActivity() {
  const { t, i18n } = useTranslation()
  const assignments = useAssignments() as any;
  const _course = useCourse() as any;
  const org = useOrg() as any;
  const submission = useAssignmentSubmission() as any;
  const taskSubmissionsMap = useAssignmentTaskSubmissions() as Record<string, any> | null;

  // Per-task grading is rendered inline only after the whole assignment has
  // been graded — that's when raw task grades are guaranteed to reflect the
  // server-verified value (auto-grade or teacher override). Before that,
  // task.grade is the placeholder 0 from save-progress.
  const isGraded = Array.isArray(submission) && submission.length > 0 && submission[0].submission_status === 'GRADED';

  // Attempt indicator. Only worth showing when the teacher actually enabled
  // retries and the student has burned at least one attempt — otherwise it's
  // noise.
  const allowRetries = !!assignments?.assignment_object?.allow_retries;
  const maxRetries = Number(assignments?.assignment_object?.max_retries || 0);
  const currentAttempt = Number(
    (Array.isArray(submission) && submission[0]?.attempt_number) || 1
  );
  const showAttemptBadge = allowRetries && currentAttempt > 1;

  // Keep per-task pass/fail aligned with the overall grade threshold on the
  // server (50% for NUMERIC / PERCENTAGE / PASS_FAIL, 60% for ALPHABET /
  // GPA_SCALE). Otherwise a student with 55% on a numeric-graded task sees
  // "Not Passed" inline while the same score is "Pass" at the assignment
  // level — exactly the mismatch the teacher tried to avoid.
  // Formative assignment: handed in, never marked. The server refuses to grade
  // it at all, so every grade affordance below is hidden rather than left
  // showing a score that can never arrive.
  const isUngraded = !!assignments?.assignment_object?.ungraded;

  // Practice set or unit test (docs/refactor/02-target-architecture.md).
  const learningRole = assignments?.assignment_object?.learning_role;
  const roleLabel = learningRole === 'assessment' ? 'Unit test' : 'Practice';
  const passMark =
    typeof assignments?.assignment_object?.pass_threshold_percentage === 'number' &&
    assignments?.assignment_object?.allow_retries
      ? assignments.assignment_object.pass_threshold_percentage
      : null;

  // Model answer ("corrigé"). `has_solution` is sent even while locked so this
  // view can promise the reward; `solution` / `solution_file` are only present
  // once the server has actually unlocked them for this learner.
  const hasSolution = !!assignments?.assignment_object?.has_solution;
  const solutionUnlocked = !!assignments?.assignment_object?.solution_unlocked;
  const solutionText = (assignments?.assignment_object?.solution || '').trim();
  const solutionFile = assignments?.assignment_object?.solution_file;
  const solutionRevealsOnSubmission =
    assignments?.assignment_object?.solution_reveal === 'ON_SUBMISSION';

  const gradingType = assignments?.assignment_object?.grading_type;
  // Honor the teacher-configured passing threshold; fall back to the
  // grading-type default when unset so existing assignments are unchanged.
  const configuredThreshold = assignments?.assignment_object?.pass_threshold_percentage;
  const passingThreshold =
    typeof configuredThreshold === 'number'
      ? configuredThreshold
      : gradingType === 'ALPHABET' || gradingType === 'GPA_SCALE'
        ? 60
        : 50;

  // Deadline state. Past the due date the server rejects EVERY write with a 403
  // (see `_is_assignment_past_due`), so the learner needs to be told before
  // auto-save starts failing behind their back.
  const dueDateRaw = assignments?.assignment_object?.due_date as string | undefined;
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!parseDueDate(dueDateRaw)) return;
    if (isAssignmentPastDue(dueDateRaw, Date.now())) return;
    // Re-evaluate while the page stays open so a deadline that passes mid-session
    // flips the UI instead of leaving a stale "still open" state.
    const interval = setInterval(() => {
      setNow(Date.now());
      if (isAssignmentPastDue(dueDateRaw, Date.now())) clearInterval(interval);
    }, 60_000);
    return () => clearInterval(interval);
  }, [dueDateRaw]);
  const isPastDue = useMemo(() => isAssignmentPastDue(dueDateRaw, now), [dueDateRaw, now]);

  // Render the raw ISO-ish string as a readable, localized date. Falls back to
  // the raw value when it can't be parsed (same tolerance as the server).
  const dueDateLabel = useMemo(() => {
    const parsed = parseDueDate(dueDateRaw);
    if (!parsed) return dueDateRaw ?? '';
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return parsed.hasTime
      ? parsed.at.toLocaleString(locale, {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : parsed.at.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [dueDateRaw, i18n.language]);

  useEffect(() => {
  }, [assignments, org])


  return (
    <div className='flex flex-col gap-4 md:gap-6'>
      <div className='flex flex-wrap justify-center gap-2 items-center'>
        <div className='flex items-center'>
          <div className='sl-badge min-h-8 px-3 text-sm text-foreground'>
            <Backpack size={14} className="md:size-[14px]" />
            <p className='font-semibold'>{roleLabel}</p>
          </div>
        </div>
        <div>
          <div className='flex gap-2 items-center flex-wrap justify-center'>
                        {!isUngraded && passMark !== null && (
              <div className='sl-badge min-h-8 px-3'>
                <CheckCircle2 size={12} />
                <span>Pass at {passMark}%{maxRetries === 0 ? ' · unlimited tries' : ''}</span>
              </div>
            )}
            {/* Practice sets and unit tests have no deadline. Only an older
                assignment that still carries one shows it, because the server
                still enforces it. */}
            {dueDateRaw && (
              <div className='flex gap-2 items-center'>
                <div className={`sl-badge min-h-8 px-3 ${isPastDue ? 'sl-badge-error' : ''}`}>
                  <Calendar size={14} />
                  <p className='font-semibold'>{t('assignments.due_date')}</p>
                  <p className='font-semibold'>{dueDateLabel}</p>
                </div>
              </div>
            )}
            {isUngraded && (
              <div className='sl-badge sl-badge-info min-h-8 px-3'>
                <ClipboardCheck size={12} />
                <span>{t('assignments.ungraded_badge', { defaultValue: 'Not graded' })}</span>
              </div>
            )}
            {showAttemptBadge && (
              <div className='sl-badge min-h-8 px-3'>
                <RotateCcw size={12} />
                <span>
                  {maxRetries
                    ? t('assignments.attempt_count_bounded', {
                        current: currentAttempt,
                        max: maxRetries,
                      })
                    : t('assignments.attempt_count', { current: currentAttempt })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      
      
      {/* Overdue notice. The server 403s every save/submit once the deadline has
          passed, so say it plainly instead of letting auto-save fail silently. */}
      {isPastDue && !isGraded && (
        <div role='alert' className='flex items-start gap-3 p-4 rounded-xl bg-error-surface border border-error/30'>
          <AlarmClockOff size={16} className='shrink-0 mt-0.5 text-error' />
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-semibold text-error'>
              {t('assignments.past_due_title', { defaultValue: 'Deadline passed' })}
            </p>
            <p className='text-sm leading-relaxed text-foreground'>
              {t('assignments.past_due_description', {
                date: dueDateLabel,
                defaultValue: 'This assignment was due on {{date}}. Answers can no longer be saved or submitted for grading.',
              })}
            </p>
          </div>
        </div>
      )}

      {assignments?.assignment_object?.description && (
        <div className='flex flex-col p-4 md:p-5 rounded-xl border border-border bg-muted/40'>
          <div className='flex flex-col space-y-3'>
            <div className='flex items-center gap-2 text-foreground'>
              <Info size={16} className="text-muted-foreground" />
              <h3 className='text-sm font-semibold'>{t('assignments.assignment_description')}</h3>
            </div>
            <div className='ps-6'>
              <p className='text-ui text-muted-foreground'>{assignments.assignment_object.description}</p>
            </div>
          </div>
        </div>
      )}
      
      
      {/* Model answer ("corrigé"). Locked, this is only a promise — the text and
          the document are withheld by the API until the learner hands their
          work in, so there is nothing here to read early. */}
      {hasSolution && !solutionUnlocked && (
        <div className='flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/40'>
          <Lock size={16} className='shrink-0 mt-0.5 text-muted-foreground' />
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-semibold text-foreground'>
              {t('assignments.solution_locked_title', { defaultValue: 'Model answer locked' })}
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              {solutionRevealsOnSubmission
                ? t('assignments.solution_locked_on_submission', { defaultValue: 'Hand your work in and the model answer unlocks right away.' })
                : t('assignments.solution_locked_after_grading', { defaultValue: 'The model answer unlocks once your work has been graded.' })}
            </p>
          </div>
        </div>
      )}

      {solutionUnlocked && (solutionText || solutionFile) && (
        <div className='flex flex-col gap-3 p-4 md:p-5 rounded-xl bg-success-surface border border-success/30'>
          <div className='flex items-center gap-2 text-foreground'>
            <BookOpenCheck size={16} className='text-success' />
            <h3 className='text-sm font-semibold'>
              {t('assignments.solution_title', { defaultValue: 'Model answer' })}
            </h3>
          </div>
          <div className='ps-6 flex flex-col space-y-3'>
            {solutionText && (
              <p className='text-reading text-foreground whitespace-pre-wrap'>{solutionText}</p>
            )}
            {solutionFile && (
              <Link
                href={getAssignmentSolutionFileDir(
                  org?.org_uuid,
                  assignments?.course_object.course_uuid,
                  assignments?.activity_object.activity_uuid,
                  assignments?.assignment_object.assignment_uuid,
                  solutionFile
                )}
                target='_blank'
                download={true}
                className='sl-btn sl-btn-secondary sl-btn-sm w-fit'>
                <Download size={14} aria-hidden />
                <p>
                  {t('assignments.solution_download', { defaultValue: 'Download the model answer' })}
                </p>
              </Link>
            )}
          </div>
        </div>
      )}

      {assignments && assignments?.assignment_tasks?.slice().sort((a: any, b: any) => a.id - b.id).map((task: any, index: number) => {
        const taskSubmission = taskSubmissionsMap ? taskSubmissionsMap[task.assignment_task_uuid] : null;
        const taskGrade = taskSubmission?.grade ?? 0;
        const taskMax = task.max_grade_value || 0;
        const taskFeedback = (taskSubmission?.task_submission_grade_feedback || '').trim();
        const taskPercentage = taskMax > 0 ? Math.round((taskGrade / taskMax) * 100) : 0;
        const taskPassed = taskPercentage >= passingThreshold;

        return (
          <div className='flex flex-col gap-3' key={task.assignment_task_uuid}>
            <div className='flex flex-col md:flex-row md:justify-between md:items-center gap-2'>
              <div className='flex flex-wrap items-baseline gap-x-2'>
                <h3 className='sl-telemetry text-link'>{t('assignments.task')} {index + 1}</h3>
                <p className='text-ui font-medium text-foreground break-words'>{task.description}</p>
              </div>
              <div className='flex flex-wrap gap-2'>
                {task.hint && <button
                  type='button'
                  onClick={() => toast(task.hint, { icon: 'ℹ️' })}
                  className='sl-btn sl-btn-secondary sl-btn-sm'>
                  <Info size={14} aria-hidden className='text-warning' />
                  {t('assignments.hint')}
                </button>}
                {task.reference_file && <Link
                  href={getTaskRefFileDir(
                    org?.org_uuid,
                    assignments?.course_object.course_uuid,
                    assignments?.activity_object.activity_uuid,
                    assignments?.assignment_object.assignment_uuid,
                    task.assignment_task_uuid,
                    task.reference_file
                  )}
                  target='_blank'
                  download={true}
                  className='sl-btn sl-btn-secondary sl-btn-sm'>
                  <Download size={14} aria-hidden />
                  <div className='flex items-center space-x-1 md:space-x-2'>
                    {task.reference_file && (
                      <span className='relative'>
                        <span className='absolute end-0 top-0 block h-2 w-2 rounded-full ring-2 ring-card bg-success'></span>
                      </span>
                    )}
                    <p>{t('assignments.reference_document')}</p>
                  </div>
                </Link>}
              </div>
            </div>
            {isGraded && !isUngraded && taskSubmission && (
              <div className={`relative overflow-hidden rounded-xl border ${
                taskPassed
                  ? 'bg-success-surface border-success/30'
                  : 'bg-error-surface border-error/30'
              }`}>
                <div className='relative p-4 flex flex-col gap-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2.5'>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-card border border-border ${
                        taskPassed ? 'text-success' : 'text-error'
                      }`}>
                        {taskPassed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </div>
                      <div className='flex flex-col leading-tight'>
                        <span className={`sl-telemetry ${
                          taskPassed ? 'text-success' : 'text-error'
                        }`}>
                          {taskPassed ? t('assignments.task_passed') : t('assignments.task_not_passed')}
                        </span>
                        <span className='text-meta text-muted-foreground'>
                          {taskPercentage}% {t('assignments.score')}
                        </span>
                      </div>
                    </div>
                    <div className='flex items-baseline gap-1 px-3 py-1.5 rounded-lg bg-card border border-border'>
                      <span className='font-display text-xl font-semibold text-foreground leading-none tabular-nums'>{taskGrade}</span>
                      <span className='text-meta font-semibold text-muted-foreground leading-none'>/ {taskMax}</span>
                    </div>
                  </div>
                  {/* Progress fill */}
                  <div className='h-1.5 w-full rounded-full bg-card overflow-hidden'>
                    <div
                      className={`h-full rounded-full ${taskPassed ? 'bg-success' : 'bg-error'}`}
                      style={{ width: `${Math.max(0, Math.min(100, taskPercentage))}%` }}
                    />
                  </div>
                  {taskFeedback && (
                    <div className='flex items-start gap-2 p-3 rounded-lg bg-card border border-border'>
                      <MessageSquare size={14} className='shrink-0 mt-0.5 text-muted-foreground' />
                      <p className='text-sm text-foreground leading-relaxed whitespace-pre-wrap'>{taskFeedback}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Key by attempt number so a retry (which wipes the server-side
                answers) remounts the editors fresh — they re-hydrate from the
                now-empty submission instead of keeping the previous attempt's
                answers as a stale saved baseline (which would submit empty ->
                0% on the next attempt). */}
            <div className='w-full'>
              {task.assignment_type === 'QUIZ' && <TaskQuizObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
              {task.assignment_type === 'FILE_SUBMISSION' && <TaskFileObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
              {task.assignment_type === 'FORM' && <TaskFormObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
              {task.assignment_type === 'CODE' && <TaskCodeObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
              {task.assignment_type === 'SHORT_ANSWER' && <TaskShortAnswerObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
              {task.assignment_type === 'NUMBER_ANSWER' && <TaskNumberAnswerObject key={`${task.assignment_task_uuid}-${currentAttempt}`} view='student' assignmentTaskUUID={task.assignment_task_uuid} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AssignmentStudentActivity
