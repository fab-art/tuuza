# TUUZA Pharmacy PWA

Responsive Vite + React + TypeScript Progressive Web App, styled after the supplied Pharmly-inspired design. Includes the supplied Rwanda FDA October 2026 working-reference workbook as a bundled searchable medicine library. **This version intentionally has no Supabase or backend integration.**

## Run locally

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this project folder to a Git repository.
2. Import the repository in Vercel.
3. Select the **Vite** framework preset. Build command: `npm run build`; output directory: `dist`.
4. Deploy. `vercel.json` adds SPA fallback rewrites (extension-less paths only, so `sw.js`, the manifest and assets are never rewritten) and cache headers (`sw.js` always revalidated, `/assets/*` immutable).

Requires Node 18.18+. `xlsx` is installed from the SheetJS CDN tarball (the npm `xlsx@0.18.5` release has known security advisories); the install step needs outbound access to `cdn.sheetjs.com`, which Vercel allows.

## What's implemented

- Responsive desktop/mobile navigation and dashboard.
- Bundled medicine library from the workbook's `Products` sheet (2,612 source rows, 14 source fields preserved, plus provenance and verification flag).
- Search across brand, generic, strength, dosage form, registration number, manufacturer and agent.
- Product add/edit/deactivate, stock/reorder threshold fields and verification status.
- XLSX/CSV import, duplicate-aware append, CSV exports and basic operational reports.
- Supplier directory (basic add/remove).
- Draft requisitions from selected products, editable status and CSV export.
- Installable PWA: manifest with 192/512/maskable PNG icons, apple-touch-icon, auto-updating service worker.
- Local persistence using IndexedDB (catalogue) and `localStorage` (suppliers, requisitions).
- Offline support via a precaching service worker; in-app install button and offline indicator.

## Storage limitation

All changes are stored in the current browser on the current device. They are not shared between users or devices, and clearing browser data can remove locally stored changes. Export regular backups. No account authentication, remote database, or server synchronization is included in this version.

Quotation OCR, editable quotation line persistence, alias approval, price comparison, supplier allocation, PDF purchasing documents, stock movement audit workflow and automated backups are not yet implemented. The Quotations screen identifies this limitation rather than implying those features work.

The supplied spreadsheet is treated as a **working reference register**, not independently verified regulatory truth. All imported records start with `source-imported-unverified`. Do not infer that missing information means a product is unregistered. Verify registration status with the current official source before making regulatory or purchasing decisions.

The initial data set lives in `src/data/medicines.json` (about 1.5 MB). It is code-split and lazy-loaded on first run only; afterwards the catalogue is read from IndexedDB. Product edits are saved in IndexedDB (with a localStorage fallback); suppliers and requisitions use localStorage. Export regular backups.

## Data import

- The bundled catalogue is loaded from the workbook's `Products` sheet.
- The import dialog accepts XLSX, XLS and CSV. Column headers such as `Generic Name`, `Brand Name`, `Registration No.`, `Strength`, `Dosage Form`, `Pack Size`, `Manufacturer`, `Country`, `MAH / Local Agent`, `Reg. Date`, and `Expiry Date` are recognized.
- Existing matching registration/name/strength combinations are skipped when importing. Review the result after import.

## Security and clinical-data boundaries

No patient data is required. Product matching and registration verification are not automated claims. This release does not make therapeutic substitution recommendations or send purchase orders to suppliers.
