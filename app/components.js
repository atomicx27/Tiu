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
 * Handles bulk browser-to-Cloudinary signed uploads with queue tracking
 */
export function UploadZone({ onUploadSuccess }) {
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [showQrModal, setShowQrModal] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDrag = (e, isOver) => {
    e.preventDefault();
    setDragOver(isOver);
  };

  const uploadSingleFile = async (itemId, file, uploadTitle) => {
    // 1. Mark as uploading
    setQueue(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: 'uploading', progress: 0 } : item
    ));

    try {
      // 2. Fetch signed parameters from server action
      const { signature, timestamp, folder, eager, context, apiKey, cloudName } = await getSignedUploadParams(uploadTitle);

      // 3. Construct direct upload form payload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('eager', eager);
      formData.append('context', context);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const currentProgress = Math.round((event.loaded / event.total) * 100);
          setQueue(prev => prev.map(item => 
            item.id === itemId ? { ...item, progress: currentProgress } : item
          ));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          
          // Force server revalidation tag
          await revalidateVideoCache();
          
          const publicId = res.public_id;
          const host = window.location.origin;
          const targetWatchUrl = `${host}/watch/${publicId}`;

          setQueue(prev => {
            const updated = prev.map(item => 
              item.id === itemId ? { ...item, status: 'completed', progress: 100, qrUrl: targetWatchUrl } : item
            );
            // Run next queued upload after a short pause
            setTimeout(() => {
              setQueue(current => {
                triggerNextUpload(current);
                return current;
              });
            }, 600);
            return updated;
          });

          if (onUploadSuccess) {
            onUploadSuccess(res);
          }
        } else {
          console.error(xhr.responseText);
          setQueue(prev => {
            const updated = prev.map(item => 
              item.id === itemId ? { ...item, status: 'failed', error: 'Upload rejected by Cloudinary' } : item
            );
            setTimeout(() => {
              setQueue(current => {
                triggerNextUpload(current);
                return current;
              });
            }, 600);
            return updated;
          });
        }
      };

      xhr.onerror = () => {
        setQueue(prev => {
          const updated = prev.map(item => 
            item.id === itemId ? { ...item, status: 'failed', error: 'Connection error' } : item
          );
          setTimeout(() => {
            setQueue(current => {
              triggerNextUpload(current);
              return current;
            });
          }, 600);
          return updated;
        });
      };

      xhr.send(formData);

    } catch (err) {
      console.error(err);
      setQueue(prev => {
        const updated = prev.map(item => 
          item.id === itemId ? { ...item, status: 'failed', error: err.message === 'Unauthorized' ? 'Session expired' : 'Auth failed' } : item
        );
        setTimeout(() => {
          setQueue(current => {
            triggerNextUpload(current);
            return current;
          });
        }, 600);
        return updated;
      });
    }
  };

  const triggerNextUpload = (currentQueue) => {
    // Check if an item is already uploading
    const active = currentQueue.find(item => item.status === 'uploading');
    if (active) return;

    // Find first pending item
    const nextItem = currentQueue.find(item => item.status === 'pending');
    if (!nextItem) {
      setUploading(false);
      return;
    }

    setUploading(true);
    uploadSingleFile(nextItem.id, nextItem.file, nextItem.title);
  };

  const addFilesToQueue = (files) => {
    const newItems = Array.from(files)
      .filter(file => file.type.startsWith('video/'))
      .map(file => {
        const isTooLarge = file.size > 100 * 1024 * 1024;
        
        // Construct clean display name from filename
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "") // strip extension
          .replace(/[_-]/g, " ")     // replace dashes/underscores with space
          .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
          
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          title: cleanName,
          progress: 0,
          status: isTooLarge ? 'failed' : 'pending',
          error: isTooLarge ? 'Exceeds 100MB limit' : '',
          qrUrl: ''
        };
      });

    if (newItems.length === 0) {
      setError('Please select valid video files (MP4, MOV, WebM).');
      return;
    }

    setError('');
    setQueue(prev => {
      const updated = [...prev, ...newItems];
      // Run triggers immediately
      triggerNextUpload(updated);
      return updated;
    });
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToQueue(files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFilesToQueue(files);
    }
  };

  const updateTitle = (itemId, newTitle) => {
    setQueue(prev => prev.map(item => 
      item.id === itemId ? { ...item, title: newTitle } : item
    ));
  };

  const clearQueue = () => {
    if (uploading) {
      const conf = window.confirm('Uploads are in progress. Cancel remaining queue?');
      if (!conf) return;
    }
    setQueue([]);
    setUploading(false);
  };

  return (
    <div className="upload-wrapper-container">
      <div 
        className={`upload-wrapper ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{ cursor: uploading ? 'not-allowed' : 'pointer', marginBottom: 'var(--space-lg)' }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          disabled={uploading}
        />
        
        <div className="upload-icon">🎁</div>
        <h3 style={{ marginBottom: 'var(--space-xs)' }}>
          {uploading ? 'Processing Bulk Upload...' : 'Drag & Drop Multiple Videos'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Select multiple files to upload in bulk (MP4, MOV, WebM, max 100MB per file)
        </p>
        
        {error && <div className="auth-error" style={{ marginTop: '10px' }}>{error}</div>}
      </div>

      {queue.length > 0 && (
        <div style={{ background: 'var(--card-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 'var(--space-xs)' }}>
            <h4 style={{ color: 'var(--primary-pink)' }}>Upload Queue ({queue.length} files)</h4>
            <button onClick={clearQueue} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: '#FF4C4C', color: '#FF4C4C' }}>
              Clear Queue 🗑️
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
            {queue.map(item => (
              <div key={item.id} style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: 'var(--space-sm) var(--space-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-violet)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    {item.status === 'pending' ? (
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateTitle(item.id, e.target.value)}
                        placeholder="Enter name for this memory..."
                        className="input-field"
                        style={{ fontSize: '0.85rem', padding: '6px 10px', marginBottom: 0, textAlign: 'left' }}
                      />
                    ) : (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {item.file.name} ({(item.file.size / (1024 * 1024)).toFixed(1)} MB)
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.status === 'pending' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Waiting... ⏳</span>}
                    {item.status === 'uploading' && <span style={{ color: 'var(--primary-pink)', fontSize: '0.75rem', fontWeight: 'bold' }}>Uploading ({item.progress}%) ⚡</span>}
                    {item.status === 'completed' && <span style={{ color: '#6BCB77', fontSize: '0.75rem', fontWeight: 'bold' }}>Success! 🎉</span>}
                    {item.status === 'failed' && <span style={{ color: '#FF4C4C', fontSize: '0.75rem', fontWeight: 'bold' }}>Failed ❌ ({item.error})</span>}

                    {item.status === 'completed' && (
                      <>
                        <a href={item.qrUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                          View 📺
                        </a>
                        <button onClick={() => setShowQrModal(item.qrUrl)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                          QR Code 📱
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.status === 'uploading' && (
                  <div className="progress-container" style={{ margin: 0, height: '8px' }}>
                    <div className="progress-bar" style={{ width: `${item.progress}%` }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal('')}>
          <QRDisplay value={showQrModal} filename="birthday-video-qr" onClose={() => setShowQrModal('')} />
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
