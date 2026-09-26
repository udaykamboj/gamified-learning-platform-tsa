'use client'

import React, { useState, useRef, useEffect } from 'react'
import { UploadCloud, Image as ImageIcon, ArrowBigUpDash } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateBoardThumbnail } from '@services/boards/boards'
import { getBoardThumbnailMediaDirectory } from '@services/media/media'
import UnsplashImagePicker from '@components/Objects/UnsplashImagePicker/UnsplashImagePicker'
import AIImageButton from '@components/Objects/AI/AIImageButton'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'

const MAX_FILE_SIZE = 8_000_000
const VALID_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const

interface BoardThumbnailTabProps {
  board: any
  boardUuid: string
  orgUuid: string
  boardKey?: string | null
}

function BoardThumbnailTab({ board, boardUuid, orgUuid, boardKey: _boardKey }: BoardThumbnailTabProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const imageInputRef = useRef<HTMLInputElement>(null)
  const [localThumbnail, setLocalThumbnail] = useState<{ url: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false)

  useEffect(() => {
    return () => {
      if (localThumbnail?.url) {
        URL.revokeObjectURL(localThumbnail.url)
      }
    }
  }, [localThumbnail])

  const thumbnailUrl = localThumbnail?.url
    || (board.thumbnail_image
      ? getBoardThumbnailMediaDirectory(orgUuid, boardUuid, board.thumbnail_image)
      : '/empty_thumbnail.png')

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    try {
      await updateBoardThumbnail(boardUuid, file, access_token)
      toast.success(t('boards.thumbnail.thumbnail_updated', 'Thumbnail updated'))
      setLocalThumbnail(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(org?.slug) })
    } catch {
      toast.error(t('boards.thumbnail.thumbnail_updated_error', 'Failed to update thumbnail'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!VALID_IMAGE_MIME_TYPES.includes(file.type as any)) {
      toast.error(t('boards.thumbnail.supported_formats', 'Supported formats: JPG, JPEG, PNG. Max 8MB.'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('boards.thumbnail.supported_formats', 'Supported formats: JPG, JPEG, PNG. Max 8MB.'))
      return
    }

    const blobUrl = URL.createObjectURL(file)
    setLocalThumbnail({ url: blobUrl })
    await uploadFile(file)
  }

  const handleAIImageFile = async (file: File) => {
    const blobUrl = URL.createObjectURL(file)
    setLocalThumbnail({ url: blobUrl })
    await uploadFile(file)
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    setShowUnsplashPicker(false)
    setIsUploading(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) {
        toast.error('URL did not return a valid image')
        setIsUploading(false)
        return
      }
      const file = new File([blob], `unsplash_${Date.now()}.jpg`, { type: blob.type })

      const blobUrl = URL.createObjectURL(file)
      setLocalThumbnail({ url: blobUrl })
      await uploadFile(file)
    } catch {
      toast.error('Failed to process Unsplash image')
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-[480px]">
        <img
          src={thumbnailUrl}
          alt={t('boards.thumbnail.alt', 'Board thumbnail')}
          className={`w-full aspect-video object-cover rounded-lg border border-gray-200 ${isUploading ? 'animate-pulse' : ''}`}
        />
      </div>

      {isUploading ? (
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm text-green-800 bg-green-50 rounded-full px-4 py-2 flex items-center">
            <ArrowBigUpDash size={16} className="me-2 animate-bounce" />
            {t('boards.thumbnail.uploading', 'Uploading...')}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={imageInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            onClick={() => imageInputRef.current?.click()}
          >
            <UploadCloud size={16} />
            {t('boards.thumbnail.upload_image', 'Upload Image')}
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            onClick={() => setShowUnsplashPicker(true)}
          >
            <ImageIcon size={16} />
            {t('boards.thumbnail.gallery', 'Gallery')}
          </button>
          <AIImageButton
            onSelect={handleUnsplashSelect}
            onSelectFile={handleAIImageFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          />
        </div>
      )}

      <p className="text-xs text-gray-400">{t('boards.thumbnail.supported_formats', 'Supported formats: JPG, JPEG, PNG. Max 8MB.')}</p>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </div>
  )
}

export default BoardThumbnailTab
