'use server';

import { v2 as cloudinary } from 'cloudinary';
import { cookies } from 'next/headers';
import { unstable_cache, revalidateTag } from 'next/cache';
import crypto from 'crypto';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Generates a secure session token hash using UPLOAD_PASSWORD and JWT_SECRET.
 * This has zero external dependencies and remains extremely secure.
 */
function generateSessionToken() {
  const secret = process.env.JWT_SECRET || 'default-tiu-birthday-token-secret-change-me-later';
  const password = process.env.UPLOAD_PASSWORD || 'tiu123';
  return crypto.createHmac('sha256', secret).update(password).digest('hex');
}

/**
 * Checks server-side cookies to verify if request is authenticated.
 */
export async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('tiu_birthday_auth')?.value;
  const expectedToken = generateSessionToken();
  return token === expectedToken;
}

/**
 * Verifies password on the server, setting a secure HTTP-only cookie on success.
 */
export async function verifyPassword(password) {
  const systemPassword = process.env.UPLOAD_PASSWORD || 'tiu123';
  
  if (password === systemPassword) {
    const token = generateSessionToken();
    const cookieStore = await cookies();
    
    cookieStore.set('tiu_birthday_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week session
    });
    
    return { success: true };
  }
  
  return { success: false, error: 'Incorrect password!' };
}

/**
 * Clear the auth cookie to logout.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('tiu_birthday_auth');
  return { success: true };
}

/**
 * Generates signature and timestamp for direct browser-to-Cloudinary signed uploads.
 * Restricts upload with server-side cookie authentication checks.
 */
export async function getSignedUploadParams(title) {
  const isAuthed = await checkAuth();
  if (!isAuthed) {
    throw new Error('Unauthorized');
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = 'tiu_videos';
  const eager = 'f_auto,q_auto'; // Eagerly trigger transcoding immediately post-upload
  
  // Format context metadata to store title in Cloudinary
  const context = `title=${encodeURIComponent(title || 'Birthday Moment')}`;

  const paramsToSign = {
    timestamp,
    folder,
    eager,
    context
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    folder,
    eager,
    context,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  };
}

/**
 * Fetches video resources from Cloudinary Admin API, cached with Next.js unstable_cache.
 * Auto-falls back if Cloudinary is not configured or errors out.
 */
export const listVideos = unstable_cache(
  async () => {
    // Check if Cloudinary credentials exist
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      console.warn('Cloudinary not configured. Returning empty video list.');
      return [];
    }

    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'video',
        prefix: 'tiu_videos/',
        max_results: 100,
        context: true // request context metadata fields
      });

      return (result.resources || []).map((video) => {
        // Extract title safely from Cloudinary context metadata
        const titleStr = video.context?.custom?.title || '';
        const decodedTitle = titleStr ? decodeURIComponent(titleStr) : (video.filename || 'Birthday Video');

        return {
          publicId: video.public_id,
          url: video.secure_url,
          created_at: video.created_at,
          filename: video.filename,
          title: decodedTitle,
          duration: video.duration || 0
        };
      });
    } catch (error) {
      console.error('Failed to list Cloudinary videos:', error);
      return [];
    }
  },
  ['cloudinary-videos-list'],
  { tags: ['cloudinary-videos'], revalidate: 3600 } // Cache for 1 hour, or revalidate manually
);

/**
 * Deletes a video asset from Cloudinary and invalidates the cached homepage list.
 */
export async function deleteVideo(publicId) {
  const isAuthed = await checkAuth();
  if (!isAuthed) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video'
    });

    if (result.result === 'ok') {
      revalidateTag('cloudinary-videos');
      return { success: true };
    }
    
    return { success: false, error: result.result };
  } catch (error) {
    console.error('Failed to delete video:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Manually trigger revalidation of the list cache (e.g. after upload finishes).
 */
export async function revalidateVideoCache() {
  revalidateTag('cloudinary-videos');
  return { success: true };
}
