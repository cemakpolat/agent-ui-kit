/**
 * DataTable
 *
 * Feature-rich data table with sorting, filtering, pagination, row selection,
 * column resizing hints, and full accessibility (ARIA grid pattern).
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { id: 'name', header: 'Name', accessor: (row) => row.name, sortable: true },
 *       { id: 'status', header: 'Status', accessor: (row) => row.status, filterable: true },
 *     ]}
 *     data={rows}
 *     pageSize={10}
 *     onRowClick={(row) => console.log(row)}
 *   />
 */
import React from 'react';
import { useTheme } from '../../ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T = Record<string, unknown>> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  /** Raw value for sorting/filtering */
  rawValue?: (row: T) => string | number;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export type SortDirection = 'asc' | 'desc';

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key extractor */
  rowKey?: (row: T, index: number) => string;
  /** Items per page. 0 = no pagination */
  pageSize?: number;
  onRowClick?: (row: T, index: number) => void;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  /** Global search filter */
  searchable?: boolean;
  /** Placeholder when no data */
  emptyMessage?: string;
  /** Compact row padding */
  compact?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Table caption for accessibility */
  caption?: string;
}

export function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  pageSize = 0,
  onRowClick,
  selectable = false,
  onSelectionChange,
  searchable = false,
  emptyMessage = 'No data available',
  compact = false,
  striped = true,
  caption,
}: DataTableProps<T>) {
  const { theme } = useTheme();
  const [sortCol, setSortCol] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc');
  const [search, setSearch] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  const getRowKey = React.useCallback(
    (row: T, index: number) => (rowKey ? rowKey(row, index) : String(index)),
    [rowKey],
  );

  // Filter
  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.rawValue ? col.rawValue(row) : col.accessor(row);
        return String(val ?? '').toLowerCase().includes(q);
      }),
    );
  }, [data, search, columns]);

  // Sort
  const sorted = React.useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.id === sortCol);
    if (!col) return filtered;
    const getValue = col.rawValue ?? ((row: T) => String(col.accessor(row) ?? ''));
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  // Paginate
  const totalPages = pageSize > 0 ? Math.ceil(sorted.length / pageSize) : 1;
  const paginated = pageSize > 0 ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted;

  // Reset page on filter/sort change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, sortCol, sortDir]);

  const handleSort = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const keys = new Set(paginated.map((row, i) => getRowKey(row, i)));
      setSelectedKeys(keys);
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // Notify parent of selection changes
  React.useEffect(() => {
    if (!onSelectionChange) return;
    const selected = data.filter((row, i) => selectedKeys.has(getRowKey(row, i)));
    onSelectionChange(selected);
  }, [selectedKeys, data, getRowKey, onSelectionChange]);

  const cellPad = compact ? '6px 10px' : '10px 14px';
  const allSelected = paginated.length > 0 && paginated.every((row, i) => selectedKeys.has(getRowKey(row, i)));

  return (
    <div style={{ fontFamily: theme.typography.family }}>
      {/* Search */}
      {searchable && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search table"
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '8px 12px',
              fontSize: 14,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              fontFamily: theme.typography.family,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          role="grid"
          aria-label={caption}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: compact ? 13 : 14,
          }}
        >
          {caption && <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th style={{ padding: cellPad, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sortCol === col.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  style={{
                    padding: cellPad,
                    textAlign: (col.align as React.CSSProperties['textAlign']) ?? 'left',
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    whiteSpace: 'nowrap',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: col.sortable ? 'none' : undefined,
                    width: col.width,
                    fontSize: compact ? 12 : 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                  onKeyDown={
                    col.sortable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSort(col.id);
                          }
                        }
                      : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                  role={col.sortable ? 'columnheader' : undefined}
                >
                  {col.header}
                  {col.sortable && sortCol === col.id && (
                    <span aria-hidden="true" style={{ marginLeft: 4 }}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: theme.colors.textMuted,
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, rowIndex) => {
                const key = getRowKey(row, rowIndex);
                const isSelected = selectedKeys.has(key);

                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    aria-selected={selectable ? isSelected : undefined}
                    style={{
                      backgroundColor: isSelected
                        ? theme.colors.accentSubtle
                        : striped && rowIndex % 2 === 1
                          ? theme.colors.surfaceAlt
                          : 'transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    {selectable && (
                      <td style={{ padding: cellPad }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(key, e.target.checked)}
                          aria-label={`Select row ${rowIndex + 1}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        style={{
                          padding: cellPad,
                          textAlign: (col.align as React.CSSProperties['textAlign']) ?? 'left',
                          borderBottom: `1px solid ${theme.colors.border}`,
                          color: theme.colors.text,
                          lineHeight: '20px',
                        }}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            fontSize: 13,
            color: theme.colors.textSecondary,
          }}
        >
          <span>
            {sorted.length} item{sorted.length !== 1 ? 's' : ''}
            {search && ` (filtered from ${data.length})`}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              style={paginationBtnStyle(theme, currentPage <= 1)}
            >
              ‹
            </button>
            <span style={{ padding: '4px 12px', fontSize: 13 }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              style={paginationBtnStyle(theme, currentPage >= totalPages)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function paginationBtnStyle(theme: { colors: { border: string; textMuted: string; text: string }; radius: { sm: string }; typography: { family: string } }, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
    color: disabled ? theme.colors.textMuted : theme.colors.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 16,
    fontFamily: theme.typography.family,
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
  };
}
