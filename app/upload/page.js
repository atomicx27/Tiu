import React from 'react';
import { checkAuth } from '../actions/cloudinary';
import { PasswordGate, UploadZone } from '../components';

export default async function Page() {
  const isAuthed = await checkAuth();

  return (
    <main className="page-container" style={{ maxWidth: '800px' }}>
      <header className="celebration-header">
        <h1>Birthday Upload Board 🎁</h1>
        <p>
          {isAuthed 
            ? "Upload new memories and generate play-instantly QR codes." 
            : "Please verify password authorization to upload new videos."}
        </p>
      </header>

      {isAuthed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <UploadZone />
          <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
            <a href="/" className="btn btn-secondary">
              ← Return to Gallery
            </a>
          </div>
        </div>
      ) : (
        <PasswordGate />
      )}
    </main>
  );
}
