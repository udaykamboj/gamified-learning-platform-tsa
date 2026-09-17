'use client'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { safeImageSrc } from '@services/security/url'
import { apiFetch } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  User,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Buildings,
  ShieldStar,
  EnvelopeSimple,
} from '@phosphor-icons/react'



interface GlobalUser {
  id: number
  user_uuid: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_image: string | null
  is_superadmin: boolean
  org_count: number
  creation_date: string
  update_date: string
}

interface PaginatedUserResponse {
  items: GlobalUser[]
  total: number
  page: number
  limit: number
}

function getAvatarUrl(userUuid: string, avatarImage: string): string {
  if (avatarImage.startsWith('http')) return avatarImage
  return getUserAvatarMediaDirectory(userUuid, avatarImage)
}

const SUPERADMIN_FILTERS = ['all', 'yes', 'no'] as const
const PAGE_SIZE = 20


export default function UserList() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get('search') || ''
  )
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get('sort') || 'id'
  )
  const [superadminFilter, setSuperadminFilter] = useState<string>(
    searchParams.get('superadmin') || 'all'
  )

  const updateUrl = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        const strVal = String(value)
        if (
          (key === 'page' && strVal === '1') ||
          (key === 'sort' && strVal === 'id') ||
          (key === 'superadmin' && strVal === 'all') ||
          (key === 'search' && strVal === '')
        ) {
          params.delete(key)
        } else {
          params.set(key, strVal)
        }
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      updateUrl({ search, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortBy,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (superadminFilter !== 'all')
      params.set('superadmin', superadminFilter)
    return params.toString()
  }, [page, sortBy, debouncedSearch, superadminFilter])

  const {
    data: userData,
    isLoading,
    isFetching,
  } = useQuery<PaginatedUserResponse>({
    queryKey: [...queryKeys.superadmin.users(), queryParams],
    queryFn: () => apiFetch(`${getAPIUrl()}superadmin/users?${queryParams}`, accessToken),
    enabled: !!accessToken,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const isValidating = isFetching

  const users = userData?.items
  const totalCount = userData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const paged = users || []

  const handleSortChange = (sort: string) => {
    setSortBy(sort)
    setPage(1)
    updateUrl({ sort, page: 1 })
  }
  const handlePageChange = (p: number) => {
    setPage(p)
    updateUrl({ page: p })
  }
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleSuperadminFilter = (val: string) => {
    setSuperadminFilter(val)
    setPage(1)
    updateUrl({ superadmin: val, page: 1 })
  }

  const avatarFallback = (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
      <User size={14} weight="fill" className="text-muted-foreground" />
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users..."
              className="sl-input ps-9 w-72 max-w-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {totalCount} user{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground me-1">Role:</span>
              {SUPERADMIN_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => handleSuperadminFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors capitalize ${
                    superadminFilter === f
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {f === 'all'
                    ? 'All'
                    : f === 'yes'
                      ? 'Superadmin'
                      : 'Regular'}
                </button>
              ))}
            </div>

          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground me-1">Sort:</span>
            {(
              [
                ['id', 'Default'],
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],

                ['username', 'Username'],
                ['recently_updated', 'Updated'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  sortBy === key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground hover:bg-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="sl-card relative overflow-hidden">
        {isValidating && !isLoading && (
          <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center pointer-events-none">
            <div className="h-5 w-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <User size={48} weight="fill" />
            <p className="mt-4 text-lg">No users found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-start text-meta font-semibold text-muted-foreground">
                    User
                  </th>
                  <th className="px-4 py-3 text-start text-meta font-semibold text-muted-foreground">
                    Email
                  </th>

                  <th className="px-4 py-3 text-start text-meta font-semibold text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 text-start text-meta font-semibold text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 text-start text-meta font-semibold text-muted-foreground">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => {
                  const fullName = [u.first_name, u.last_name]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border hover:bg-accent transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_image ? (
                            <img
                              src={safeImageSrc(getAvatarUrl(u.user_uuid, u.avatar_image))}
                              alt={u.username}
                              className="h-8 w-8 rounded-full object-cover bg-card"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display =
                                  'none'
                              }}
                            />
                          ) : (
                            avatarFallback
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {u.username}
                            </p>
                            {fullName && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {fullName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <EnvelopeSimple
                            size={12}
                            weight="bold"
                            className="text-muted-foreground/70 shrink-0"
                          />
                          <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                            {u.email}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {u.is_superadmin ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                            <ShieldStar size={12} weight="fill" />
                            Superadmin
                          </span>
                        ) : (
                          <span className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {u.creation_date
                            ? new Date(u.creation_date).toLocaleDateString()
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {u.update_date
                            ? new Date(u.update_date).toLocaleDateString()
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <CaretLeft size={14} weight="bold" data-dir-flip />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 1
                    )
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-muted-foreground/70 text-xs px-1">
                            ...
                          </span>
                        )}
                        <button
                          onClick={() => handlePageChange(p)}
                          className={`text-xs min-w-[28px] h-7 rounded transition-colors ${
                            p === page
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, page + 1))
                    }
                    disabled={page === totalPages}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <CaretRight size={14} weight="bold" data-dir-flip />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
