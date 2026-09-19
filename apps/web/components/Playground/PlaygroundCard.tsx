'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Globe,
  Lock,
  Users,
  Pencil,
  Eye,
  Copy,
  Trash2,
  MoreVertical,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Cube } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Playground } from '@services/playgrounds/playgrounds'
import { getPlaygroundThumbnailMediaDirectory } from '@services/media/media'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'

interface PlaygroundCardProps {
  playground: Playground
  orgslug: string
  canEdit?: boolean
  isSelected?: boolean
  onToggleSelect?: (pgUuid: string) => void
  onDuplicate?: (pgUuid: string) => Promise<void>
  onDelete?: (pgUuid: string) => Promise<void>
}

const accessConfig = {
  public: { icon: Globe, label: 'Public', className: 'bg-green-100 text-green-700' },
  authenticated: { icon: Lock, label: 'Members', className: 'bg-blue-100 text-blue-700' },
  restricted: { icon: Users, label: 'Restricted', className: 'bg-amber-100 text-amber-700' },
}

export default function PlaygroundCard({
  playground,
  orgslug: _orgslug,
  canEdit,
  isSelected = false,
  onToggleSelect,
  onDuplicate,
  onDelete,
}: PlaygroundCardProps) {
  const { track } = useLHAnalytics('learner')
  const access = accessConfig[playground.access_type as keyof typeof accessConfig] || accessConfig.authenticated
  const AccessIcon = access.icon

  const handleOpen = () => {
    track(AnalyticsEvent.PlaygroundOpened, {
      access_type: playground.access_type,
      published: playground.published,
      source: 'card',
    })
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(playground.playground_uuid)
  }

  const thumbnailUrl =
    playground.thumbnail_image && playground.org_uuid
      ? getPlaygroundThumbnailMediaDirectory(
          playground.org_uuid,
          playground.playground_uuid,
          playground.thumbnail_image
        )
      : null

  const playgroundLink = `/playground/${playground.playground_uuid}`

  return (
    <div
      className={`group relative flex flex-col bg-white rounded-xl nice-shadow overflow-hidden w-full transition-all duration-300 hover:scale-[1.01] ${
        isSelected ? 'ring-2 ring-black ring-offset-2' : ''
      }`}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <button
          onClick={handleSelectClick}
          aria-label={isSelected ? 'Deselect playground' : 'Select playground'}
          className={`absolute top-2 start-2 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-md ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-black" />
          ) : (
            <Square className="w-4 h-4 text-gray-500" />
          )}
        </button>
      )}

      {/* Options menu */}
      <PlaygroundCardOptions
        playground={playground}
        canEdit={canEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />

      {/* Thumbnail */}
      <Link href={playgroundLink} onClick={handleOpen} className="block relative aspect-video overflow-hidden bg-gray-50">
        {thumbnailUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 transition-transform duration-500 group-hover:scale-105">
            <Cube size={36} className="text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />

        {/* Badges — bottom left */}
        <div className="absolute bottom-2 start-2 flex items-center gap-1.5">
          <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${access.className}`}>
            <AccessIcon className="w-2.5 h-2.5" />
            {access.label}
          </span>
          {!playground.published && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 rounded-full">
              Draft
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 flex flex-col space-y-1.5">
        <Link
          href={playgroundLink}
          onClick={handleOpen}
          className="text-base font-bold text-gray-900 leading-tight hover:text-black transition-colors line-clamp-1"
        >
          {playground.name}
        </Link>

        {playground.description && (
          <p className="text-[11px] text-gray-500 line-clamp-2 min-h-[1.5rem]">
            {playground.description}
          </p>
        )}

        <div className="pt-1.5 flex items-center justify-end border-t border-gray-100">
          <Link
            href={playgroundLink}
            onClick={handleOpen}
            className="text-[10px] font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider"
          >
            Open Playground →
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlaygroundCardOptions({
  playground,
  canEdit,
  onDuplicate,
  onDelete,
}: {
  playground: Playground
  canEdit?: boolean
  onDuplicate?: (pgUuid: string) => Promise<void>
  onDelete?: (pgUuid: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const playgroundLink = `/playground/${playground.playground_uuid}`
  const editLink = `/editor/playground/${playground.playground_uuid}/edit`

  return (
    <div
      className={`absolute top-2 end-2 z-20 transition-opacity ${
        !isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
      }`}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Playground actions"
            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-md"
          >
            <MoreVertical size={18} className="text-gray-700" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={playgroundLink} className="flex items-center cursor-pointer">
              <Eye className="me-2 h-4 w-4" />
              {t('playgrounds.open_playground', 'Open Playground')}
            </Link>
          </DropdownMenuItem>

          {canEdit && (
            <DropdownMenuItem asChild>
              <Link href={editLink} className="flex items-center cursor-pointer">
                <Pencil className="me-2 h-4 w-4" />
                {t('playgrounds.edit_playground', 'Edit in Editor')}
              </Link>
            </DropdownMenuItem>
          )}

          {onDuplicate && (
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('playgrounds.duplicate_playground', 'Duplicate Playground')}
                confirmationMessage={t(
                  'playgrounds.duplicate_playground_confirm',
                  'Are you sure you want to duplicate this playground?'
                )}
                dialogTitle={t('playgrounds.duplicate_playground_title', {
                  name: playground.name,
                  defaultValue: `Duplicate "${playground.name}"`,
                })}
                dialogTrigger={
                  <button className="w-full text-start flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                    <Copy className="me-2 h-4 w-4" />
                    {t('playgrounds.duplicate_playground', 'Duplicate Playground')}
                  </button>
                }
                functionToExecute={() => onDuplicate(playground.playground_uuid)}
                status="info"
              />
            </DropdownMenuItem>
          )}

          {canEdit && onDelete && (
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('playgrounds.delete_playground', 'Delete Playground')}
                confirmationMessage={t(
                  'playgrounds.delete_playground_confirm',
                  'Are you sure you want to delete this playground? This action cannot be undone.'
                )}
                dialogTitle={t('playgrounds.delete_playground_title', {
                  name: playground.name,
                  defaultValue: `Delete "${playground.name}"`,
                })}
                dialogTrigger={
                  <button className="w-full text-start flex items-center px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="me-2 h-4 w-4" />
                    {t('playgrounds.delete_playground', 'Delete Playground')}
                  </button>
                }
                functionToExecute={() => onDelete(playground.playground_uuid)}
                status="warning"
              />
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
