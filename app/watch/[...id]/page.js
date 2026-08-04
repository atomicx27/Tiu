import React from 'react';
import { WatchPlayer } from '../../components';

export default async function Page({ params }) {
  // Await the route params for Next.js 15 App Router compatibility
  const { id } = await params;
  const publicId = id.join('/');

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  // Format Cloudinary dynamic CDN deliver URLs
  const videoSrc = `https://res.cloudinary.com/${cloudName}/video/upload/f_auto,q_auto/v1/${publicId}.mp4`;
  const posterSrc = `https://res.cloudinary.com/${cloudName}/video/upload/f_auto,q_auto,so_0/v1/${publicId}.jpg`;

  return (
    <main className="watch-page-container">
      {/* Immersive Playback Header */}
      <header className="watch-header">
        <div className="watch-logo">Saisha's Birthday Box 🎈</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Scan code to replay • Created by Tiu
        </p>
      </header>

      {/* Render optimized client video component */}
      <WatchPlayer src={videoSrc} poster={posterSrc} />

      <div style={{ marginTop: 'var(--space-lg)' }}>
        <a href="/" className="btn btn-outline" style={{ textDecoration: 'none' }}>
          ← View All Memories
        </a>
      </div>
    </main>
  );
}
