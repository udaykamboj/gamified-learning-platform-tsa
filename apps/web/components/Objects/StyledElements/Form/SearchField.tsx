'use client'
import React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Labeled search input with a clear control, shared by catalog pages. */
export default function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:w-80', className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder ?? label}
        className="sl-input ps-10 pe-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
