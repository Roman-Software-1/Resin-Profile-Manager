# Resin Profile Manager

Resin profile manager web app for calibration, dimensional checks, and slicer settings.

## Run locally

```bash
npm install
npm run dev
```

## Build locally

```bash
npm run build
npm run preview
```

## GitHub Pages hosting

Use the built-in branch deploy mode (simplest setup for this static app).

1. Open repository **Settings** -> **Pages**
2. Under **Build and deployment** set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
3. Click **Save**

GitHub Pages will publish directly from `index.html` in the root.

Expected site URL:

- `https://roman-software-1.github.io/Resin-Profile-Manager/`

## Connect to Lovable

1. In Lovable, choose **Import from GitHub**
2. Select `Roman-Software-1/Resin-Profile-Manager`
3. Set project type to static web (or generic web app)
4. Use:
   - Install command: `npm install`
   - Dev command: `npm run dev`
   - Build command: `npm run build`

Lovable can then edit and commit changes back to this repository.

## Supabase cloud persistence setup

The app now supports cloud sync with Supabase while keeping local storage as a fallback.

### 1) Create a Supabase project

1. Create/open your project in the Supabase dashboard.
2. In **Authentication** -> **Providers**, enable **Email** sign-in.
3. In **Authentication** -> **URL Configuration**, add your app URL(s), for example:
   - `https://roman-software-1.github.io/Resin-Profile-Manager/`
   - `http://localhost:5173`

### 2) Create the table + RLS policies

Run `supabase/cloud-schema.sql` in the Supabase SQL editor.

### 3) Configure the app

Option A (easy): use the in-app **Cloud setup** button and paste:
- Project URL (`https://<project-ref>.supabase.co`)
- Publishable/anon key

Option B: set defaults in `scripts/cloud-config.js`.

### 4) Sign in and sync

1. Click **Cloud sign in** and complete the email magic link.
2. Click **Sync now** to upload your current local data.
3. Future saves auto-sync when signed in.

## Persistence behavior

- **Always**: local browser persistence (`localStorage`).
- **When cloud is configured + signed in**: data also syncs to Supabase.
- If both local and cloud data exist, the app prefers the newer cloud copy on load.
