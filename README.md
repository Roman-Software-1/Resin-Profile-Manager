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
