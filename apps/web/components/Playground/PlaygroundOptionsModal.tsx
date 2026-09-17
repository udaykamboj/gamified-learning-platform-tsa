'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Globe,
  Lock,
  Users,
  FloppyDisk,
  X,
  Plus,
  TextT,
  ShieldCheck,
  Image,
  UploadSimple,
  CircleNotch,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useRouter } from 'next/navigation'
import {
  deletePlayground,
  updatePlayground,
  updatePlaygroundThumbnail,
  getPlaygroundShares,
  sharePlayground,
  unsharePlayground,
  Playground,
  PlaygroundAccessType,
} from '@services/playgrounds/playgrounds'
import { getPlaygroundThumbnailMediaDirectory } from '@services/media/media'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import UnsplashImagePicker from '@components/Objects/UnsplashImagePicker/UnsplashImagePicker'
import AIImageButton from '@components/Objects/AI/AIImageButton'
import toast from 'react-hot-toast'

type Tab = 'general' | 'access' | 'thumbnail'

interface PlaygroundOptionsModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  playground: Playground
  orgslug: string
  onUpdated: (_updated: Playground) => void
}

export default function PlaygroundOptionsModal({
  open,
  onOpenChange,
  playground,
  orgslug,
  onUpdated,
}: PlaygroundOptionsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <TextT size={14} weight="bold" /> },
    { id: 'access', label: 'Sharing', icon: <ShieldCheck size={14} weight="bold" /> },
    { id: 'thumbnail', label: 'Thumbnail', icon: <Image size={14} weight="bold" /> },
  ]

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={onOpenChange}
      minWidth="lg"
      minHeight="lg"
      noPadding
      dialogContent={
        <div className="flex h-full min-h-[680px]">
          {/* Sidebar */}
          <div className="w-44 flex-shrink-0 border-e border-gray-100 bg-gray-50/60 flex flex-col py-4 px-3 gap-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
              Playground
            </p>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-start ${
                  activeTab === tab.id
                    ? 'bg-card nice-shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-card/60'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <GeneralTab playground={playground} orgslug={orgslug} onUpdated={onUpdated} />
            )}
            {activeTab === 'access' && (
              <AccessTab
                playground={playground}
                orgslug={orgslug}
                onUpdated={onUpdated}
              />
            )}
            {activeTab === 'thumbnail' && (
              <ThumbnailTab playground={playground} orgslug={orgslug} onUpdated={onUpdated} />
            )}
          </div>
        </div>
      }
    />
  )
}

/* ── General Tab ── */
function GeneralTab({
  playground,
  orgslug,
  onUpdated,
}: {
  playground: Playground
  orgslug: string
  onUpdated: (_p: Playground) => void
}) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [name, setName] = useState(playground.name)
  const [description, setDescription] = useState(playground.description || '')
  const [isSaving, setIsSaving] = useState(false)

  // Sync when playground prop changes
  useEffect(() => {
    setName(playground.name)
    setDescription(playground.description || '')
  }, [playground.name, playground.description])

  const hasChanges =
    name !== playground.name || description !== (playground.description || '')

  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const handleDelete = async () => {
    if (!window.confirm(`Delete "${playground.name}"? This can't be undone.`)) return
    setIsDeleting(true)
    try {
      await deletePlayground(playground.playground_uuid, access_token)
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      toast.success('Playground deleted')
      router.push('/playgrounds')
    } catch {
      toast.error('Failed to delete playground')
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const updated = await updatePlayground(
        playground.playground_uuid,
        { name: name.trim(), description: description.trim() || undefined },
        access_token
      )
      onUpdated(updated)
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.detail(playground.playground_uuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      toast.success('Playground updated')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-0.5">General settings</h2>
        <p className="text-xs text-gray-400">Update the name and description of your playground.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            placeholder="Playground name"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
            placeholder="Describe what this playground does…"
          />
        </div>
      </div>

      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-black nice-shadow transition-all disabled:opacity-50"
          >
            <FloppyDisk size={14} weight="bold" />
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {playground.my_role === 'owner' && (
        <div className="pt-6 border-t border-gray-100 space-y-2">
          <p className="text-sm font-bold text-gray-800">Delete playground</p>
          <p className="text-xs text-gray-400">This removes the playground for you and everyone you shared it with.</p>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold transition-all disabled:opacity-50"
          >
            <X size={14} weight="bold" />
            {isDeleting ? 'Deleting…' : 'Delete playground'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Access Tab ── */
function AccessTab({
  playground,
  orgslug,
  onUpdated,
}: {
  playground: Playground
  orgslug: string
  onUpdated: (_p: Playground) => void
}) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const isOwner = playground.my_role === 'owner'

  const queryClient = useQueryClient()
  const [accessType, setAccessType] = useState<PlaygroundAccessType>(playground.access_type)
  const [isSaving, setIsSaving] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer')
  const [isSharing, setIsSharing] = useState(false)

  const sharesKey = [...queryKeys.playgrounds.detail(playground.playground_uuid), 'shares']
  const { data: shares } = useQuery({
    queryKey: sharesKey,
    queryFn: () => getPlaygroundShares(playground.playground_uuid, access_token),
    enabled: !!access_token,
    staleTime: 60_000,
  })

  const handleSetAccess = async (type: PlaygroundAccessType) => {
    if (!isOwner || type === accessType || isSaving) return
    setIsSaving(true)
    const previous = accessType
    setAccessType(type)
    try {
      const updated = await updatePlayground(
        playground.playground_uuid,
        { access_type: type },
        access_token
      )
      onUpdated(updated)
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.detail(playground.playground_uuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      toast.success('Access updated')
    } catch {
      setAccessType(previous)
      toast.error('Failed to update access')
    } finally {
      setIsSaving(false)
    }
  }

  const handleShare = async () => {
    const value = identifier.trim()
    if (!value || isSharing) return
    setIsSharing(true)
    try {
      await sharePlayground(playground.playground_uuid, value, shareRole, access_token)
      setIdentifier('')
      toast.success('Playground shared')
      queryClient.invalidateQueries({ queryKey: sharesKey })
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Could not share with that person')
    } finally {
      setIsSharing(false)
    }
  }

  const handleUnshare = async (userId: number) => {
    try {
      await unsharePlayground(playground.playground_uuid, userId, access_token)
      toast.success('Removed')
      queryClient.invalidateQueries({ queryKey: sharesKey })
    } catch {
      toast.error('Failed to remove')
    }
  }

  const ACCESS_OPTIONS: {
    type: PlaygroundAccessType
    icon: React.ReactNode
    label: string
    description: string
  }[] = [
    {
      type: 'restricted',
      icon: <Lock size={22} weight="duotone" className="text-amber-500" />,
      label: 'Private',
      description: 'Only you and the people you share it with.',
    },
    {
      type: 'authenticated',
      icon: <Users size={22} weight="duotone" className="text-sky-500" />,
      label: 'Anyone signed in with the link',
      description: 'Any signed-in member who has the link can open it.',
    },
    {
      type: 'public',
      icon: <Globe size={22} weight="duotone" className="text-green-500" />,
      label: 'Public',
      description: 'Anyone on the internet with the link can open it.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-0.5">Sharing</h2>
        <p className="text-xs text-gray-400">
          {isOwner ? 'Choose who can open this playground.' : 'Only the owner can change who can open this playground.'}
        </p>
      </div>

      {/* Access type cards */}
      <div className={`space-y-2 ${isSaving || !isOwner ? 'opacity-60 pointer-events-none' : ''}`}>
        {ACCESS_OPTIONS.map((opt) => {
          const active = accessType === opt.type
          return (
            <button
              key={opt.type}
              onClick={() => handleSetAccess(opt.type)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-start ${
                active
                  ? 'border-sky-500 bg-sky-50/50'
                  : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-card'
              }`}
            >
              <div className="flex-shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${active ? 'text-sky-700' : 'text-gray-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              </div>
              {active && (
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-card" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* People */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-800">People</p>
          <p className="text-xs text-gray-400">People you shared this playground with</p>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleShare() }}
              placeholder="Username or email"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
            <select
              value={shareRole}
              onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="viewer">Can view</option>
              <option value="editor">Can edit</option>
            </select>
            <button
              onClick={handleShare}
              disabled={!identifier.trim() || isSharing}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-primary text-primary-foreground text-xs font-black nice-shadow transition-all disabled:opacity-50"
            >
              <Plus size={12} weight="bold" />
              Share
            </button>
          </div>
        )}

        <div className="rounded-xl border border-gray-100 overflow-hidden">
          {!shares || shares.length === 0 ? (
            <div className="py-8 text-center">
              <Lock size={20} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Not shared with anyone yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-start px-4 py-2.5 text-xs font-semibold text-gray-500">Person</th>
                  <th className="text-start px-4 py-2.5 text-xs font-semibold text-gray-500">Access</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.user_id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-800">@{share.username}</td>
                    <td className="px-4 py-3 text-gray-500">{share.role === 'editor' ? 'Can edit' : 'Can view'}</td>
                    <td className="px-4 py-3 text-end">
                      {isOwner && (
                        <button
                          onClick={() => handleUnshare(share.user_id)}
                          className="flex items-center gap-1 ms-auto h-7 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all"
                        >
                          <X size={11} weight="bold" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Thumbnail Tab ── */
const MAX_FILE_SIZE = 8_000_000
const VALID_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const

function ThumbnailTab({
  playground,
  orgslug,
  onUpdated,
}: {
  playground: Playground
  orgslug: string
  onUpdated: (_p: Playground) => void
}) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showUnsplash, setShowUnsplash] = useState(false)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const thumbnailUrl =
    localPreview ||
    (playground.thumbnail_image && playground.org_uuid
      ? getPlaygroundThumbnailMediaDirectory(
          playground.org_uuid,
          playground.playground_uuid,
          playground.thumbnail_image
        )
      : null)

  const doUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const updated = await updatePlaygroundThumbnail(playground.playground_uuid, file, access_token)
      onUpdated(updated)
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.detail(playground.playground_uuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      setLocalPreview(null)
      toast.success('Thumbnail updated')
    } catch {
      toast.error('Failed to upload thumbnail')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!VALID_IMAGE_MIME_TYPES.includes(file.type as any)) {
      toast.error('Please upload a PNG or JPG image')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (max 8MB)`)
      e.target.value = ''
      return
    }
    setLocalPreview(URL.createObjectURL(file))
    await doUpload(file)
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    try {
      const url = new URL(imageUrl)
      if (!['https:', 'http:'].includes(url.protocol)) {
        toast.error('Invalid image URL')
        return
      }
      setIsUploading(true)
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) {
        toast.error('URL did not return a valid image')
        setIsUploading(false)
        return
      }
      const file = new File([blob], `unsplash_${Date.now()}.jpg`, { type: blob.type })
      setLocalPreview(URL.createObjectURL(file))
      await doUpload(file)
    } catch {
      toast.error('Failed to process Unsplash image')
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-0.5">Thumbnail</h2>
        <p className="text-xs text-gray-400">Upload an image or pick one from Unsplash.</p>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100 aspect-video bg-gray-50 flex items-center justify-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Thumbnail preview"
            className={`w-full h-full object-cover ${isUploading ? 'opacity-60' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Image size={36} weight="duotone" />
            <span className="text-xs">No thumbnail</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CircleNotch size={14} weight="bold" className="animate-spin text-sky-500" />
          Uploading…
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 bg-card hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all nice-shadow"
          >
            <UploadSimple size={14} weight="bold" />
            Upload image
          </button>
          <button
            onClick={() => setShowUnsplash(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 bg-card hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all nice-shadow"
          >
            <Image size={14} weight="bold" />
            Unsplash
          </button>
          <AIImageButton
            onSelect={handleUnsplashSelect}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 bg-card hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all nice-shadow"
          />
        </div>
      )}
      <p className="text-xs text-gray-400">PNG or JPG · Max 8MB</p>

      {showUnsplash && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplash(false)}
        />
      )}
    </div>
  )
}
