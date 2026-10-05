'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { categories, formats, type Book } from '@/data/books'

export type FilterState = {
  category: string
  inStockOnly: boolean
  formats: string[]
}

type FilterSidebarProps = {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onClose?: () => void
}

export function FilterSidebar({ filters, onChange, onClose }: FilterSidebarProps) {
  const toggleFormat = (format: string) => onChange({
    ...filters,
    formats: filters.formats.includes(format) ? filters.formats.filter((item) => item !== format) : [...filters.formats, format]
  })

  return <aside className="filter-sidebar">
    <div className="filter-sidebar-heading">{onClose && <button className="drawer-close" type="button" aria-label="Close filters" onClick={onClose}><X size={18} /></button>}</div>
    <div className="filter-group category-filter" id="categories"><h3>Category</h3>{categories.map(({ name, count }) => <button className={`category-option ${filters.category === name ? 'selected' : ''}`} type="button" onClick={() => onChange({ ...filters, category: name })} key={name}><span>{name}</span><small>{count}</small></button>)}</div>
    <div className="filter-group"><h3>Availability</h3><label className="check-option"><input type="checkbox" checked={filters.inStockOnly} onChange={(event) => onChange({ ...filters, inStockOnly: event.target.checked })} /><span className="custom-checkbox" /><span>In stock</span></label><label className="check-option"><input type="checkbox" checked={!filters.inStockOnly} onChange={(event) => onChange({ ...filters, inStockOnly: !event.target.checked })} /><span className="custom-checkbox" /><span>All titles</span></label></div>
    <div className="filter-group"><h3>Format</h3>{formats.map(({ name, label, count }) => <label className="check-option" key={name}><input type="checkbox" checked={filters.formats.includes(name)} onChange={() => toggleFormat(name)} /><span className="custom-checkbox" /><span className="check-label">{label}<small>{count}</small></span></label>)}</div>
    <button className="reset-filters" type="button" onClick={() => onChange({ category: 'All', inStockOnly: false, formats: [] })}><SlidersHorizontal size={14} /> Reset filters</button>
  </aside>
}

export function filterBooks(items: Book[], filters: FilterState) {
  return items.filter((book) =>
    (filters.category === 'All' || book.category === filters.category) &&
    (!filters.inStockOnly || book.status === 'in-stock') &&
    (!filters.formats.length || filters.formats.includes(book.format))
  )
}
