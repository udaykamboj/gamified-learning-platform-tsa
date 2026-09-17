'use client'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { ChartBar } from '@phosphor-icons/react'
import { queryKeys } from '@/lib/query/keys'

export default function GlobalAnalytics({ days = 30 }: { days?: number }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.superadmin.analytics(), days],
    queryFn: () => apiFetch(`${getAPIUrl()}superadmin/analytics/global?days=${days}`, accessToken),
    enabled: !!accessToken,
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoading />

  if (error || !data) {
    return (
      <div className="sl-card flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <ChartBar size={24} aria-hidden />
        </span>
        <p className="mt-4 text-card-title font-semibold text-foreground">
          {error ? 'Failed to load analytics' : 'No analytics data available'}
        </p>
        <p className="mt-1 text-ui text-muted-foreground">
          Ensure Tinybird analytics is configured
        </p>
      </div>
    )
  }

  const queryNames = Object.keys(data)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {queryNames.map((queryName) => {
        const queryData = data[queryName]
        const rows = queryData?.data || []
        const firstRow = rows[0] || {}
        const values = Object.entries(firstRow)

        const format = (val: unknown) => (typeof val === 'number' ? val.toLocaleString() : String(val))
        const title = queryName.replace(/_/g, ' ')

        return (
          <div key={queryName} className="sl-card p-5 md:p-6">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">{title}</h3>
            {values.length === 1 ? (
              // Single metric: label, prominent value, unit.
              <p className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-page font-semibold tabular-nums text-foreground">
                  {format(values[0][1])}
                </span>
                <span className="text-ui text-muted-foreground">{values[0][0].replace(/_/g, ' ')}</span>
              </p>
            ) : values.length > 0 ? (
              <dl className="mt-3 divide-y divide-border">
                {values.map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-ui capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
                    <dd className="text-ui font-semibold tabular-nums text-foreground">{format(val)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-ui text-muted-foreground">No data for this period</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
