import React from 'react';
import { listVideos, checkAuth } from './actions/cloudinary';
import { VideoGallery } from './components';

export const revalidate = 3600; // Keep ISR validation fallback of 1 hour

export default async function Page() {
  // Fetch cached list of videos directly on the server
  const videos = await listVideos();
  const isAdmin = await checkAuth();

  return (
    <main className="page-container">
      {/* Playful Celebratory Header */}
      <header className="celebration-header">
        <h1>Happy Birthday Saisha! 🎈</h1>
        <p>A collection of beautiful birthday video memories • Made with love by Tiu</p>
      </header>

      {/* Render Client-side video gallery layout */}
      <VideoGallery initialVideos={videos} isAdmin={isAdmin} />
      
      <footer style={{ marginTop: 'var(--space-3xl)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <p>Tiu's Birthday Video Box for Saisha © {new Date().getFullYear()}</p>
        <p style={{ marginTop: 'var(--space-2xs)' }}>
          <a href="/upload" style={{ color: 'var(--primary-pink)', textDecoration: 'none', fontWeight: '600' }}>
            {isAdmin ? 'Manage Dashboard ⚙️' : 'Access Admin Panel 🔑'}
          </a>
        </p>
      </footer>
    </main>
  );
}
