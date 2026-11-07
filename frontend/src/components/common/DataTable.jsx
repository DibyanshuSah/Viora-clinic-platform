import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';

const DataTable = ({
  columns = [],
  data = [],
  searchPlaceholder = 'Search records...',
  searchKey = '',
  loading = false,
  emptyMessage = 'No records found in VIORA system',
  pageSize = 10,
  actionButton = null,
  filters = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Search filtering
  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (searchKey && item[searchKey]) {
      return String(item[searchKey]).toLowerCase().includes(term);
    }
    return Object.values(item).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes(term)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* TOOLBAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingRight: searchTerm ? '32px' : '12px' }}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {filters}
          {actionButton}
        </div>
      </div>

      {/* TABLE */}
      <div className="table-container">
        <table className="v-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    width: col.width || 'auto',
                    textAlign: col.align || 'left'
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: 'var(--role-admin-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Loading data...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Inbox size={36} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{emptyMessage}</span>
                    {searchTerm && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Try clearing or modifying your search filter
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        textAlign: col.align || 'left'
                      }}
                    >
                      {col.render
                        ? col.render(row)
                        : col.accessor
                        ? row[col.accessor]
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION FOOTER */}
      {filteredData.length > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '8px 4px',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)'
          }}
        >
          <span>
            Showing <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1}</strong> to{' '}
            <strong style={{ color: 'var(--text-main)' }}>{Math.min(startIndex + pageSize, filteredData.length)}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{filteredData.length}</strong> entries
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontWeight: 600, padding: '0 6px', color: 'var(--text-main)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
