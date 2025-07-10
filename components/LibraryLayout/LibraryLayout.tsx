import React from 'react'
import styles from './LibraryLayout.module.css'

export default function LibraryLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.libraryLayout}>
      {children}
    </div>
  )
} 