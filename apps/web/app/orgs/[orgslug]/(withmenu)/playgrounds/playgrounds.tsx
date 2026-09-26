'use client'

import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { Search, X, Trash2 } from 'lucide-react'
import { Cube } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import PlaygroundCard from '@components/Playground/PlaygroundCard'
import {
  Playground,
  createPlayground,
  deletePlayground,
  duplicatePlayground,
} from '@services/playgrounds/playgrounds'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { searchMatchesAny } from '@/lib/search/normalize'
import CatalogPagination, { useCatalogPagination } from '@components/Objects/Catalog/CatalogPagination'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'

interface PlaygroundsClientProps {
  orgslug: string
  org_id: number
  initialPlaygrounds: Playground[]
}

function CreatePlaygroundForm({
  onCreated,
  orgId,
  accessToken,
  isCreating,
  setIsCreating,
  onCancel,
}: {
  onCreated: (_newPg: Playground) => void
  orgId: number
  accessToken: string
  isCreating: boolean
  setIsCreating: (_val: boolean) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { track } = useLHAnalytics('learner')
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || isCreating) return
    const playgroundName = name.trim() || 'Untitled Playground'
    setIsCreating(true)
    try {
      const newPlayground = await createPlayground(
        orgId,
        { name: playgroundName, access_type: 'restricted' },
        accessToken
      )
      track(AnalyticsEvent.PlaygroundCreated, {
        name_provided: name.trim().length > 0,
        source: 'learner',
      })
      toast.success(t('playgrounds.new_playground_modal_title', 'Playground created'))
      setName('')
      onCreated(newPlayground)
    } catch {
      toast.error(t('playgrounds.failed_create', 'Failed to create playground'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div>
        <label className="text-sm font-medium text-gray-700">
          {t('boards.name', 'Name')}
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Photosynthesis Quiz"
          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
          required
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={isCreating || !name.trim()}
          className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-gray-800 transition-colors"
        >
          {isCreating ? t('playgrounds.creating', 'Creating...') : t('playgrounds.create', 'Create')}
        </button>
      </div>
    </form>
  )
}

export default function PlaygroundsClient({
  orgslug,
  org_id,
  initialPlaygrounds,
}: PlaygroundsClientProps) {
  const router = useRouter()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [playgrounds, setPlaygrounds] = useState<Playground[]>(initialPlaygrounds)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [selectedPlaygrounds, setSelectedPlaygrounds] = useState<Set<string>>(new Set())
  const { t } = useTranslation()

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return playgrounds
    return playgrounds.filter((p) =>
      searchMatchesAny([p.name, p.description], searchQuery)
    )
  }, [playgrounds, searchQuery])

  const {
    currentPage,
    totalPages,
    paginatedItems: paginated,
    pageNumbers,
    goToPage: goToCatalogPage,
    resetPage,
  } = useCatalogPagination(filtered)

  React.useEffect(() => {
    resetPage()
  }, [searchQuery, resetPage])

  const togglePlaygroundSelection = (pgUuid: string) => {
    const newSelection = new Set(selectedPlaygrounds)
    if (newSelection.has(pgUuid)) {
      newSelection.delete(pgUuid)
    } else {
      newSelection.add(pgUuid)
    }
    setSelectedPlaygrounds(newSelection)
  }

  const selectAllPlaygrounds = () => {
    const allUuids = paginated.map((pg) => pg.playground_uuid)
    setSelectedPlaygrounds(new Set(allUuids))
  }

  const clearSelection = () => {
    setSelectedPlaygrounds(new Set())
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      goToCatalogPage(page)
      setSelectedPlaygrounds(new Set())
    }
  }

  const bulkDeletePlaygrounds = async () => {
    if (!access_token) return
    const toastId = toast.loading(
      t('playgrounds.deleting_playgrounds', {
        count: selectedPlaygrounds.size,
        defaultValue: `Deleting ${selectedPlaygrounds.size} playground(s)...`,
      })
    )
    let successCount = 0
    let errorCount = 0

    for (const pgUuid of selectedPlaygrounds) {
      try {
        await deletePlayground(pgUuid, access_token)
        successCount++
      } catch {
        errorCount++
      }
    }

    toast.dismiss(toastId)
    if (errorCount === 0) {
      toast.success(
        t('playgrounds.playgrounds_deleted_success', {
          count: successCount,
          defaultValue: `${successCount} playground(s) deleted`,
        })
      )
    } else {
      toast.error(
        t('playgrounds.playgrounds_deleted_partial', {
          success: successCount,
          error: errorCount,
          defaultValue: `${successCount} deleted, ${errorCount} failed`,
        })
      )
    }

    clearSelection()
    setPlaygrounds((prev) => prev.filter((p) => !selectedPlaygrounds.has(p.playground_uuid)))
    queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
  }

  const handleDeletePlayground = async (pgUuid: string) => {
    if (!access_token) return
    const toastId = toast.loading(t('playgrounds.deleting_playground', 'Deleting playground...'))
    try {
      await deletePlayground(pgUuid, access_token)
      setPlaygrounds((prev) => prev.filter((p) => p.playground_uuid !== pgUuid))
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      toast.success(t('playgrounds.playground_deleted_success', 'Playground deleted'))
    } catch {
      toast.error(t('playgrounds.playground_deleted_error', 'Failed to delete playground'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleDuplicatePlayground = async (pgUuid: string) => {
    if (!access_token) return
    const toastId = toast.loading(t('playgrounds.duplicating_playground', 'Duplicating playground...'))
    try {
      const duplicated = await duplicatePlayground(pgUuid, access_token)
      setPlaygrounds((prev) => [duplicated, ...prev])
      queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
      toast.success(t('playgrounds.playground_duplicated_success', 'Playground duplicated'))
    } catch {
      toast.error(t('playgrounds.playground_duplicated_error', 'Failed to duplicate playground'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleCreated = (newPlayground: Playground) => {
    setShowNameModal(false)
    setPlaygrounds((prev) => [newPlayground, ...prev])
    queryClient.invalidateQueries({ queryKey: queryKeys.playgrounds.list(orgslug) })
    router.push(`/editor/playground/${newPlayground.playground_uuid}/edit`)
  }

  return (
    <>
      <div className="w-full">
        <GeneralWrapperStyled>
          <div className="flex flex-col space-y-2 mb-2">
            <div className="flex items-center justify-between">
              <TypeOfContentTitle title={t('common.playgrounds', 'Playgrounds')} type="pg" />
              {access_token && (
                <button
                  onClick={() => setShowNameModal(true)}
                  disabled={isCreating}
                  className="rounded-lg bg-black transition-all duration-100 ease-linear antialiased p-2 px-5 my-auto font text-xs font-bold text-white nice-shadow flex space-x-2 items-center hover:scale-105 disabled:opacity-50"
                >
                  <div>{t('playgrounds.new_playground', 'New Playground')}</div>
                  <div className="text-md bg-neutral-800 px-1 rounded-full">+</div>
                </button>
              )}
            </div>

            {/* Search and Bulk Actions */}
            {playgrounds.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search playgrounds"
                    placeholder={t('playgrounds.search_placeholder', 'Search playgrounds...')}
                    className="w-full ps-10 pe-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute end-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bulk Actions */}
                {selectedPlaygrounds.size > 0 && (
                  <div className="flex items-center gap-2 ms-auto flex-wrap">
                    <span className="text-sm font-medium text-gray-500 px-2">
                      {t('playgrounds.selected_count', {
                        count: selectedPlaygrounds.size,
                        defaultValue: `${selectedPlaygrounds.size} selected`,
                      })}
                    </span>
                    <button
                      onClick={selectAllPlaygrounds}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white nice-shadow rounded-lg transition-colors"
                    >
                      <span>{t('playgrounds.select_all', 'Select All')}</span>
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white nice-shadow rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>{t('playgrounds.clear_selection', 'Clear')}</span>
                    </button>
                    <ConfirmationModal
                      confirmationButtonText={t('playgrounds.delete_selected', 'Delete Selected')}
                      confirmationMessage={t('playgrounds.delete_selected_confirm', {
                        count: selectedPlaygrounds.size,
                        defaultValue: `Are you sure you want to delete ${selectedPlaygrounds.size} playground(s)? This action cannot be undone.`,
                      })}
                      dialogTitle={t('playgrounds.delete_playgrounds_title', 'Delete Playgrounds')}
                      dialogTrigger={
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 bg-white nice-shadow rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                          <span>{t('playgrounds.delete_selected', 'Delete Selected')}</span>
                        </button>
                      }
                      functionToExecute={bulkDeletePlaygrounds}
                      status="warning"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Search results info */}
            {searchQuery && (
              <div className="mb-2 text-sm text-gray-500">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginated.map((pg) => (
                <PlaygroundCard
                  key={pg.playground_uuid}
                  playground={pg}
                  orgslug={orgslug}
                  canEdit={pg.my_role === 'owner' || pg.my_role === 'editor'}
                  isSelected={selectedPlaygrounds.has(pg.playground_uuid)}
                  onToggleSelect={togglePlaygroundSelection}
                  onDuplicate={access_token ? handleDuplicatePlayground : undefined}
                  onDelete={handleDeletePlayground}
                />
              ))}

              {filtered.length === 0 && searchQuery && (
                <div className="col-span-full flex flex-col justify-center items-center py-12 px-4">
                  <Search className="w-12 h-12 text-gray-300 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-600 mb-2">
                    {t('playgrounds.no_results_for', 'No results for')} &quot;{searchQuery}&quot;
                  </h2>
                  <p className="text-gray-400">
                    {t('playgrounds.try_different_search', 'Try a different search term')}
                  </p>
                </div>
              )}

              {playgrounds.length === 0 && !searchQuery && (
                <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                  <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                    <Cube className="w-8 h-8 text-gray-300" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-600 mb-2">
                    {t('playgrounds.no_playgrounds_yet', 'No playgrounds yet')}
                  </h1>
                  <p className="text-md text-gray-400 mb-6 max-w-xs text-center">
                    {t('playgrounds.playgrounds_description', 'Create interactive AI-generated experiences for your learners.')}
                  </p>
                  {access_token && (
                    <button
                      onClick={() => setShowNameModal(true)}
                      disabled={isCreating}
                      className="rounded-lg bg-black transition-all duration-100 ease-linear antialiased p-2 px-5 my-auto font text-xs font-bold text-white nice-shadow flex space-x-2 items-center hover:scale-105 disabled:opacity-50"
                    >
                      <div>{t('playgrounds.new_playground', 'New Playground')}</div>
                      <div className="text-md bg-neutral-800 px-1 rounded-full">+</div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <CatalogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageNumbers={pageNumbers}
              onPageChange={goToPage}
              previousLabel="Previous"
              nextLabel="Next"
              className="mt-8"
            />

            {totalPages > 1 && (
              <div className="mt-2 text-center text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>
        </GeneralWrapperStyled>
      </div>

      {/* Create Modal */}
      <Modal
        isDialogOpen={showNameModal}
        onOpenChange={setShowNameModal}
        dialogTitle={t('playgrounds.new_playground_modal_title', 'New Playground')}
        dialogDescription={t('playgrounds.new_playground_modal_desc', 'Give your playground a name to get started.')}
        customWidth="sm:max-w-md"
        dialogContent={
          <CreatePlaygroundForm
            onCreated={handleCreated}
            orgId={org_id}
            accessToken={access_token}
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            onCancel={() => setShowNameModal(false)}
          />
        }
      />
    </>
  )
}
