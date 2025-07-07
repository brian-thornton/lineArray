"use client"

import { Fragment } from 'react'
import styles from './Pagination.module.css'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
  itemsPerPage: number
}

function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getVisiblePages = (): (number | string)[] => {
    const pages = []
    const maxVisible = 5 // Show max 5 page numbers
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show smart pagination with ellipsis
      if (currentPage <= 3) {
        // Near start: show 1, 2, 3, 4, ..., last
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        // Near end: show 1, ..., last-3, last-2, last-1, last
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Middle: show 1, ..., current-1, current, current+1, ..., last
        pages.push(1)
        pages.push('...')
        pages.push(currentPage - 1)
        pages.push(currentPage)
        pages.push(currentPage + 1)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const handlePageClick = (page: number | string): void => {
    if (typeof page === 'number') {
      onPageChange(page)
    }
  }

  const handlePrevious = (): void => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = (): void => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.info}>
        <span className={styles.results}>
          Showing {startItem}-{endItem} of {totalItems} albums
        </span>
      </div>
      
      <nav className={styles.pagination} role="navigation" aria-label="Pagination">
        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span className={styles.navText}>Previous</span>
        </button>

        <div className={styles.pageNumbers}>
          {visiblePages.map((page, index) => (
            // eslint-disable-next-line react/no-array-index-key -- pagination items are static and non-reorderable
            <Fragment key={index}>
              {page === '...' ? (
                <span className={styles.ellipsis} aria-hidden="true">...</span>
              ) : (
                <button
                  className={`${styles.pageButton} ${styles.numberButton} ${
                    page === currentPage ? styles.active : ''
                  }`}
                  onClick={() => handlePageClick(page)}
                  aria-label={`Go to page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              )}
            </Fragment>
          ))}
        </div>

        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
        >
          <span className={styles.navText}>Next</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </nav>
    </div>
  )
}

export default Pagination 