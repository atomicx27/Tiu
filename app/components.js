'use client';

import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { verifyPassword, getSignedUploadParams, revalidateVideoCache, deleteVideo } from './actions/cloudinary';

/**
 * 1. PasswordGate Component
 * Protects routes by validating passwords server-side and setting HTTP-only cookie
 */
export function PasswordGate({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await verifyPassword(password);
      if (res.success) {
        if (onAuthenticated) onAuthenticated();
        else window.location.reload();
      } else {
        setError(res.error || 'Access denied!');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon">🎉</div>
        <h2 style={{ marginBottom: 'var(--space-xs)' }}>Enter Password</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          Tiu's Video Box for Saisha is private. Please enter the password to gain access.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Secret password..."
            className="input-field"
            disabled={loading}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock Video Box 🔑'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * 2. QRDisplay Component
 * Displays a QR code and allows downloading as PNG or copying the video URL
 */
export function QRDisplay({ value, filename, onClose }) {
  const [copied, setCopied] = useState(false);
  const qrId = `qr-${Math.random().toString(36).substr(2, 9)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svgElement = document.getElementById(qrId);
    if (!svgElement) return;

    const size = 300;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      
      // Paint bright white background
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, size, size);
      
      // Draw SVG onto canvas
      context.drawImage(image, 0, 0, size, size);
      
      const png = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = png;
      downloadLink.download = `${filename || 'birthday-qr'}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  return (
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
      )}
      <h3 style={{ marginBottom: 'var(--space-xs)' }}>Video QR Code</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
        Scan this code with a mobile camera to play the video instantly!
      </p>
      
      <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)', marginBottom: 'var(--space-md)' }}>
        <QRCodeSVG
          id={qrId}
          value={value}
          size={200}
          level="H"
          marginSize={2}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={handleDownload} className="btn btn-primary">
          Download PNG 📥
        </button>
        <button onClick={handleCopy} className="btn btn-secondary">
          {copied ? 'Copied! ✅' : 'Copy Link 🔗'}
        </button>
      </div>
    </div>
  );
}

/**
 * 3. UploadZone Component
 * Handles direct signed browser-to-Cloudinary uploads with progress bar
 */
export function UploadZone({ onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDrag = (e, isOver) => {
    e.preventDefault();
    setDragOver(isOver);
  };

  const processUpload = async (file) => {
    if (!file) return;
    if (!title.trim()) {
      setError('Please enter a video title first!');
      return;
    }
    
    // Cloudinary free tier max video size is 100MB
    if (file.size > 100 * 1024 * 1024) {
      setError('Video is too large! Maximum allowed size is 100MB.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');
    setQrUrl('');

    try {
      // 1. Fetch server-signed credentials
      const { signature, timestamp, folder, eager, context, apiKey, cloudName } = await getSignedUploadParams(title);

      // 2. Prepare Form Data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('eager', eager);
      formData.append('context', context);

      // 3. Perform Direct XHR POST
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          
          // Invalidate server caching list
          await revalidateVideoCache();
          
          // Generate target scan watch URL
          const publicId = res.public_id;
          const host = window.location.origin;
          const targetWatchUrl = `${host}/watch/${publicId}`;

          setQrUrl(targetWatchUrl);
          setTitle('');
          setProgress(100);
          
          if (onUploadSuccess) {
            onUploadSuccess(res);
          }
        } else {
          console.error(xhr.responseText);
          setError('Upload failed. Please verify credentials and try again.');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        setError('Network error occurred during upload.');
        setUploading(false);
      };

      xhr.send(formData);

    } catch (err) {
      console.error(err);
      setError(err.message === 'Unauthorized' ? 'Session expired. Please log in again.' : 'Failed to initialize upload credentials.');
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processUpload(file);
    } else {
      setError('Please drop a valid video file! (MP4, MOV, etc.)');
    }
  };

  return (
    <div className="upload-wrapper-container">
      {qrUrl ? (
        <div className="modal-overlay" onClick={() => setQrUrl('')} style={{ position: 'relative', zIndex: 10, background: 'none', padding: 0 }}>
          <QRDisplay value={qrUrl} filename="birthday-video-qr" onClose={() => setQrUrl('')} />
        </div>
      ) : (
        <div 
          className={`upload-wrapper ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDrag(e, true)}
          onDragLeave={(e) => handleDrag(e, false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            style={{ display: 'none' }}
            disabled={uploading}
          />
          
          <div className="upload-icon">🎁</div>
          <h3 style={{ marginBottom: 'var(--space-xs)' }}>
            {uploading ? 'Uploading Video...' : 'Drag & Drop Birthday Video'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
            or click to browse local files (MP4, MOV, WebM, max 100MB)
          </p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()} // stop file picker trigger
            placeholder="Name this memory (e.g. Cutting the cake 🎂)"
            className="input-field"
            disabled={uploading}
            style={{ maxWidth: '320px', margin: '0 auto var(--space-md) auto', display: 'block' }}
          />

          {uploading && (
            <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
              </div>
              <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--primary-pink)' }}>
                {progress}% uploaded
              </span>
            </div>
          )}

          {error && <div className="auth-error" style={{ marginTop: '10px' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * 4. VideoCard Component
 * Displays video details and triggers QR modals or Deletions
 */
export function VideoCard({ video, onRefresh, isAdmin }) {
  const [showQr, setShowQr] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cloudinary poster extraction (optimized image representation)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const posterUrl = `https://res.cloudinary.com/${cloudName}/video/upload/f_auto,q_auto,so_0/${video.publicId}.jpg`;
  
  // Dynamic watch URL
  const watchUrl = typeof window !== 'undefined' ? `${window.location.origin}/watch/${video.publicId}` : '';

  const handleDelete = async (e) => {
    e.stopPropagation();
    const conf = window.confirm(`Are you sure you want to delete this birthday memory: "${video.title}"?`);
    if (!conf) return;

    setDeleting(true);
    try {
      const res = await deleteVideo(video.publicId);
      if (res.success) {
        if (onRefresh) onRefresh();
      } else {
        alert(`Failed to delete: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Unauthorized or connection error occurred.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCardClick = () => {
    window.location.href = `/watch/${video.publicId}`;
  };

  return (
    <>
      <div className="video-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
        <div className="card-thumbnail-wrapper">
          <img src={posterUrl} alt={video.title} className="card-thumbnail" loading="lazy" />
          <div className="play-overlay">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="qr-badge" onClick={(e) => { e.stopPropagation(); setShowQr(true); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
        </div>

        <div className="card-content">
          <div>
            <h4 className="card-title">{video.title}</h4>
            <span className="card-date">
              📅 {new Date(video.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="card-actions">
            <button 
              className="btn btn-outline" 
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
              onClick={(e) => { e.stopPropagation(); setShowQr(true); }}
            >
              Get QR Code 📱
            </button>
            {isAdmin && (
              <button 
                className="btn btn-primary" 
                style={{ background: '#FF4C4C', flex: 0.3, padding: '8px 12px', fontSize: '0.8rem' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '...' : '🗑️'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showQr && (
        <div className="modal-overlay" onClick={() => setShowQr(false)}>
          <QRDisplay 
            value={watchUrl} 
            filename={video.filename} 
            onClose={() => setShowQr(false)} 
          />
        </div>
      )}
    </>
  );
}

/**
 * 5. VideoGallery Component
 * Wraps search input, empty state handling, and the responsive bento grid
 */
export function VideoGallery({ initialVideos, isAdmin }) {
  const [search, setSearch] = useState('');
  
  const filtered = (initialVideos || []).filter(v => 
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-xl)' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search birthday memories..."
          className="input-field"
          style={{ maxWidth: '400px', margin: 0, padding: '12px 20px', borderRadius: 'var(--radius-full)' }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-xs)' }}>🎈</div>
          <h3 style={{ marginBottom: 'var(--space-2xs)' }}>No memories found</h3>
          <p style={{ fontSize: '0.9rem' }}>
            {initialVideos.length === 0 ? "Let's upload our first video!" : "Try searching for another name!"}
          </p>
        </div>
      ) : (
        <div className="bento-grid">
          {filtered.map((video) => (
            <VideoCard 
              key={video.publicId} 
              video={video} 
              isAdmin={isAdmin}
              onRefresh={() => window.location.reload()} 
            />
          ))}
        </div>
      )}

      {/* Floating Upload present FAB button */}
      <a href="/upload" className="fab" title="Manage Video Box">
        <svg viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </a>
    </div>
  );
}

/**
 * 6. WatchPlayer Component
 * Native HTML5 video player with custom unmute trigger overlay for mobile autoplay
 */
export function WatchPlayer({ src, poster }) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef(null);
  
  const handleUnmute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = false;
      setMuted(false);
    }
  };
  
  return (
    <div className="watch-player-wrapper" style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        autoPlay
        muted={muted}
        className="watch-video"
      />
      {muted && (
        <button className="unmute-overlay" onClick={handleUnmute}>
          🔊 Tap to Unmute
        </button>
      )}
    </div>
  );
}
