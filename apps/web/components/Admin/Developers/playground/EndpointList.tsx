'use client'
import React, { useMemo, useState } from 'react'
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { ENDPOINTS, CATEGORIES, type EndpointDoc, type HttpMethod } from '@components/Admin/Developers/catalog'

const METHOD_CLS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  POST: 'bg-sky-100 text-sky-700 border-sky-200',
  PUT: 'bg-amber-100 text-amber-700 border-amber-200',
  PATCH: 'bg-violet-100 text-violet-700 border-violet-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
}

export default function EndpointList({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ENDPOINTS
    return ENDPOINTS.filter((e) =>
      [e.title, e.pathTemplate, e.method, e.category, e.description]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [query])

  const byCategory = useMemo(() => {
    const m: Record<string, EndpointDoc[]> = {}
    for (const c of CATEGORIES) m[c] = []
    for (const e of matches) (m[e.category] = m[e.category] ?? []).push(e)
    return m
  }, [matches])

  const toggleCategory = (c: string) =>
    setCollapsed((s) => ({ ...s, [c]: !s[c] }))

  return (
    <div className="flex flex-col h-full">
      <div className="relative p-3 border-b border-border">
        <MagnifyingGlass
          size={14}
          weight="bold"
          className="absolute start-6 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search endpoints…"
          className="w-full bg-card border border-border rounded-lg ps-8 pe-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {CATEGORIES.map((cat) => {
          const items = byCategory[cat] ?? []
          if (items.length === 0) return null
          const isCollapsed = collapsed[cat]
          return (
            <section key={cat} className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-start hover:bg-accent transition-colors"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {cat}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
                  <CaretDown
                    size={12}
                    weight="bold"
                    className={
                      'text-muted-foreground transition-transform ' + (isCollapsed ? '-rotate-90' : '')
                    }
                  />
                </span>
              </button>
              {!isCollapsed && (
                <ul>
                  {items.map((e) => {
                    const isActive = e.id === selectedId
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => onSelect(e.id)}
                          className={
                            'w-full flex items-start gap-2.5 px-3 py-2 text-start border-s-2 transition-colors ' +
                            (isActive
                              ? 'bg-muted border-border'
                              : 'border-transparent hover:bg-accent')
                          }
                        >
                          <span
                            className={
                              'shrink-0 mt-0.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-meta font-semibold border font-mono w-12 ' +
                              METHOD_CLS[e.method]
                            }
                          >
                            {e.method}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-foreground truncate">{e.title}</span>
                            <span className="block text-[11px] text-muted-foreground font-mono truncate">
                              /{e.pathTemplate}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}

        {Object.values(byCategory).every((v) => v.length === 0) && (
          <div className="px-3 py-10 text-center text-xs text-muted-foreground">
            No endpoints match "{query}"
          </div>
        )}
      </div>
    </div>
  )
}
