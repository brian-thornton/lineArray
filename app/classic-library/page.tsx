import React, { useState, useEffect } from 'react';
import { Album } from '@/types/music';
import ClassicLibraryGrid from '@/components/ClassicLibraryGrid/ClassicLibraryGrid';

export default function ClassicLibraryPage(): JSX.Element {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const albumsPerPage = 4;

  useEffect(() => {
    async function fetchAlbums(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await fetch('/api/albums');
        if (response.ok) {
          const data = (await response.json()) as { albums: Album[] };
          setAlbums(data.albums || []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void fetchAlbums();
  }, []);

  const totalPages = Math.max(1, Math.ceil(albums.length / albumsPerPage));
  const pagedAlbums = albums.slice((page - 1) * albumsPerPage, page * albumsPerPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  if (isLoading) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: '2rem' }}>Loading…</div>;
  }

  return (
    <ClassicLibraryGrid
      albums={pagedAlbums}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
    />
  );
} 