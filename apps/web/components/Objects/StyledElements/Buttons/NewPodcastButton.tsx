'use client'
import { useTranslation } from 'react-i18next'

interface NewPodcastButtonProps {
  disabled?: boolean
}

function NewPodcastButton({ disabled = false }: NewPodcastButtonProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`sl-btn sl-btn-primary ${disabled ? 'pointer-events-none bg-disabled text-disabled-fg' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <span aria-hidden className="text-lg leading-none">+</span>
      {t('podcasts.new_podcast')}
    </div>
  )
}

export default NewPodcastButton
