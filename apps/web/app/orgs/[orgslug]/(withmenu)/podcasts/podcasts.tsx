'use client'

import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import PodcastThumbnail from '@components/Objects/Thumbnails/PodcastThumbnail'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { PodcastWithEpisodeCount } from '@services/podcasts/podcasts'
import { Headphones, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate'
import { searchMatchesAny } from '@/lib/search/normalize'
import { useTrackView, AnalyticsEvent } from '@services/analytics'
import CatalogPagination, { useCatalogPagination } from '@components/Objects/Catalog/CatalogPagination'

interface PodcastsClientProps {
  orgslug: string
  org_id: number
  initialPodcasts: PodcastWithEpisodeCount[]
}

export default function PodcastsClient({
  orgslug,
  org_id,
  initialPodcasts,
}: PodcastsClientProps) {
  const { t } = useTranslation()
  const allPodcasts = initialPodcasts
  const searchParams = useSearchParams()

  useTrackView(
    AnalyticsEvent.PodcastsListViewed,
    { total_podcasts_count: allPodcasts.length },
    true,
    'learner',
  )

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter podcasts based on search
  const filteredPodcasts = useMemo(() => {
    if (!searchQuery.trim()) return allPodcasts
    return allPodcasts.filter((podcast: PodcastWithEpisodeCount) =>
      searchMatchesAny([podcast.name, podcast.description, podcast.tags], searchQuery)
    )
  }, [allPodcasts, searchQuery])

  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedPodcasts,
    pageNumbers,
    goToPage,
    resetPage,
  } = useCatalogPagination(filteredPodcasts)

  // Reset to page 1 when search changes
  React.useEffect(() => {
    resetPage()
  }, [searchQuery, resetPage])

  return (
    <FeatureGate feature="podcasts" orgslug={orgslug} context="public">
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('podcasts.podcasts')} type="pod" />
          </div>

          {/* Search */}
          {allPodcasts.length > 0 && (
            <div className="relative w-full sm:w-80 mb-4">
              <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('podcasts.search_placeholder')}
                placeholder={t('podcasts.search_placeholder')}
                className="w-full ps-10 pe-10 py-2.5 bg-card nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-0"
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
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-2 text-sm text-gray-500">
              {t('podcasts.search_results', { count: filteredPodcasts.length, query: searchQuery })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {paginatedPodcasts.map((podcast: PodcastWithEpisodeCount) => (
              <div key={podcast.podcast_uuid} className="">
                <PodcastThumbnail podcast={podcast} orgslug={orgslug} />
              </div>
            ))}
            {filteredPodcasts.length === 0 && searchQuery && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4">
                <Search className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="sl-section-title mb-2">
                  {t('podcasts.no_search_results')}
                </h2>
                <p className="text-gray-400">
                  {t('podcasts.try_different_search')}
                </p>
              </div>
            )}
            {allPodcasts.length === 0 && !searchQuery && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 sl-card text-center">
                <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
                  <Headphones className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                </div>
                <h1 className="text-card-title font-semibold text-foreground mb-1">
                  {t('podcasts.no_podcasts')}
                </h1>
                <p className="text-ui text-muted-foreground mb-6 text-center max-w-md">
                  {t('podcasts.no_podcasts_description')}
                </p>
              </div>
            )}
          </div>

          <CatalogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageNumbers={pageNumbers}
            onPageChange={goToPage}
            previousLabel={t('pagination.previous')}
            nextLabel={t('pagination.next')}
            className="mt-8"
          />

          {/* Pagination info */}
          {totalPages > 1 && (
            <div className="mt-2 text-center text-sm text-gray-500">
              {t('pagination.showing_page', { current: currentPage, total: totalPages })}
            </div>
          )}
        </div>
      </GeneralWrapperStyled>
    </div>
    </FeatureGate>
  )
}
