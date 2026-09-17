'use client'
import { useTranslation } from 'react-i18next'

interface NewCourseButtonProps {
  disabled?: boolean
}

function NewCourseButton({ disabled = false }: NewCourseButtonProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`sl-btn sl-btn-primary ${disabled ? 'pointer-events-none bg-disabled text-disabled-fg' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <span aria-hidden className="text-lg leading-none">+</span>
      {t('courses.new_course')}
    </div>
  )
}

export default NewCourseButton
