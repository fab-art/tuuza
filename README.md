# TUUZA Pharmacy Procurement PWA

A local-first Vite + React + TypeScript PWA focused on the pharmacy purchasing workflow: build one master requisition, capture supplier quotations against the same product lines, compare offers, allocate suppliers, export one purchase list per supplier, record deliveries and calculate retail prices. No Supabase or backend is configured.

## Run locally

```bash
npm install
npm run dev
```

Production build and preview:

```bash
npm run build
npm run preview
```

## Vercel

Use Vite framework preset, `npm run build` build command and `dist` output directory. Root directory should contain `package.json`.

## Workflow included

- Bundled 2,612-row medicine reference library from the supplied Rwanda FDA workbook.
- Typo-tolerant local suggestions across generic name, brand, strength, dosage form and registration number. Exact product details must be verified before purchase.
- One master requisition per purchasing round; repeated additions of the same catalogue item increase its quantity rather than creating duplicate lines.
- Supplier directory with contact details and commercial notes.
- Supplier quotations recorded against existing requisition lines, including price, availability, quoted pack size, delivery days and notes.
- Lowest-price recommendation among offers with stock; delivery time is a tie-breaker. Users can manually select a different supplier.
- Separate XLSX purchase-list export for each selected supplier and master-list export.
- Receiving records and retail-price calculation: actual purchase cost per pack / sellable units per pack × markup factor (default 1.5).
- JSON backup and restore for catalogue and operational data. XLSX exports for catalogue, requisitions, supplier purchase lists and receipt/pricing records.
- PWA assets and Vercel SPA routing.

## Important limitations

All operational data is saved on the current browser/device. There is no authentication, multi-user access, synchronization, automated supplier emailing, OCR, automatic regulatory verification, or remote database. Back up regularly; browser clearing can remove local changes. Supplier allocation is a recommendation and never sends an order.

The bundled catalogue is a working reference, not a guarantee of current registration status. Product match suggestions are heuristic and do not establish clinical equivalence. Check strength, dosage form, pack size, manufacturer and registration details before purchase.

## Supplier quotation logic

The default recommendation is the lowest price among entered offers with available quantity greater than zero; delivery days break price ties. This initial version compares the entered quoted unit price directly, so the user must ensure prices are normalized to comparable packs/units before comparing. Complex partial-quantity allocation, landed cost, minimum-order optimization and transport-cost optimization are future improvements.
