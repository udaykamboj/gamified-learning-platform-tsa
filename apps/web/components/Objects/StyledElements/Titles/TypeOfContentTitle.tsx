import React from 'react'
import { BookCopy, SquareLibrary, Signpost, Headphones } from 'lucide-react'
import { ChalkboardSimple, Cube } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface TypeOfContentTitleProps {
  title: string
  type: 'col' | 'cou' | 'tra' | 'pod' | 'board' | 'pg' | string
}

function TypeOfContentTitle({ title, type }: TypeOfContentTitleProps) {
  const { t } = useTranslation()

  const getIcon = () => {
    switch (type) {
      case 'col':
        return <SquareLibrary className="w-5 h-5" />
      case 'cou':
        return <BookCopy className="w-5 h-5" />
      case 'tra':
        return <Signpost className="w-5 h-5" />
      case 'pod':
        return <Headphones className="w-5 h-5" />
      case 'board':
        return <ChalkboardSimple size={20} />
      case 'pg':
        return <Cube size={20} />
      default:
        return null
    }
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center justify-center size-10 shrink-0 rounded-[10px] border border-border bg-card text-link shadow-sm">
        {getIcon()}
      </div>
      <h1 className="sl-page-title">
        {title}
      </h1>
    </div>
  )
}

export default TypeOfContentTitle
