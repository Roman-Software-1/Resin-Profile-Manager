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

This repo includes `.github/workflows/deploy-pages.yml` to deploy automatically on every push to `main`.

If this is the first deployment:

1. Open repository **Settings** -> **Pages**
2. Set **Source** to **GitHub Actions**
3. Save

The site will then publish from Actions runs.

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
