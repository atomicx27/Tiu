# Saisha's Birthday Video Box 🎈

A personalized, interactive video sharing catalog built with love by **Tiu** for **Saisha's birthday**. 

This application allows you to upload birthday celebration videos directly to Cloudinary, generate high-quality QR codes for each video, and download/print them. When scanned with any mobile device, the QR code redirects immediately to an optimized, mobile-friendly immersive playback page that bypasses mobile autoplay blocks.

---

## 📸 Design & Features

*   **Dopamine Celebration Palette:** Decorated in warm, celebratory colors (Rose Pink, Sunny Gold, Sky Mint, Soft Violet) and animated with bouncy spring transitions.
*   **Playful Bento Grid:** Homepage displays a frosted-glass bento grid catalog of all uploaded video memories with hover overlays and download badges.
*   **Zero-Database Architecture:** Cloudinary acts as both the media CDN and the metadata database (via the Admin API), removing database hosting overhead.
*   **Direct-to-Cloudinary Signed Uploads:** Uploads go straight from the browser to Cloudinary, bypassing Vercel's 4.5MB request payload limit.
*   **HTTP-Only Secure Auth:** Password-protected upload and delete operations validated server-side via session cookies.
*   **Eager Transcoding:** Uploaded videos are pre-transcoded immediately so scans load instantly without buffering.
*   **Watch Page Autoplay:** The watch page opens directly to a native video player with a custom "Tap to Unmute" button to bypass browser restriction policies.

---

## 🛠️ Tech Stack

*   **Framework:** Next.js 15 (App Router, Server Actions, React 19)
*   **Styling:** Custom Vanilla CSS (no Tailwind dependency)
*   **Video Delivery:** Cloudinary SDK
*   **QR Generation:** `qrcode.react` (SVG renderer with client-side canvas-to-PNG download)

---

## ⚙️ Configuration (`.env.local`)

Create a `.env.local` file in the root directory (configured automatically on your machine):

```env
# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dhowlg0hg
CLOUDINARY_API_KEY=439151193913152
CLOUDINARY_API_SECRET=A3EW-0FM09qHxAeqcDZKKCN4UCQ

# Security Settings
UPLOAD_PASSWORD=tiu123
JWT_SECRET=default-tiu-birthday-token-secret-change-me-later
```

---

## 🚀 Getting Started

### 1. Run the Development Server Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the homepage. Navigate to `/upload` (password: `tiu123`) to upload videos.

### 2. Cloudinary Upload Preset Configuration
To enable signed direct uploads:
1. Go to your **Cloudinary Settings** → **Upload**.
2. Click **Add upload preset**.
3. Set **Preset name** to `ml_default` (or your custom name matching the preset).
4. Set **Signing Mode** to **Signed**.
5. Set **Folder** to `tiu_videos`.
6. Click **Save**.

---

## 📦 Deployment to Vercel

1. Link your local project to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for Saisha's video box"
   git branch -M main
   git remote add origin https://github.com/atomicx27/Tiu.git
   git push -u origin main
   ```
2. Open your Vercel Dashboard, import the repository, and add all 5 environment variables from `.env.local` to the project settings.
3. Click **Deploy**!
