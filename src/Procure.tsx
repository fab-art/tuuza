import React, {useMemo, useRef, useState} from 'react'
import {Plus, Download, Copy, Trash2, Search, Check} from 'lucide-react'
import type {Medicine, Supplier} from './types'

export type Line = {id: string; pid: string; name: string; qty: number}
export type Req = {
  id: string; date: string; note: string; status: string; lines: Line[]
  quotes: Record<string, Record<string, number>> // lineId -> supplierId -> price (0/blank = not available)
  pick: Record<string, string> // lineId -> supplierId chosen manually
  rec: Record<string, {qty: number; cost: number}> // lineId -> received
}
type P = {
  products: Medicine[]; suppliers: Supplier[]; setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>
  setProducts: React.Dispatch<React.SetStateAction<Medicine[]>>; reqs: Req[]; setReqs: React.Dispatch<React.SetStateAction<Req[]>>
  notify: (s: string) => void; exportCSV: (rows: any[], filename: string) => Promise<void>
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const fmt = (n: number) => new Intl.NumberFormat('en-RW', {maximumFractionDigits: 0}).format(n)
const label = (p: Medicine) => [p.brandName || p.genericName, p.brandName && p.genericName && p.genericName !== p.brandName ? `(${p.genericName})` : '', p.strength, p.dosageForm].filter(Boolean).join(' ')
const lev = (a: string, b: string) => {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// Supplier allocation: only-one-supplier -> auto; else lowest price; equal prices -> balance totals; manual pick always wins.
export function allocate(r: Req, sups: Supplier[]) {
  const asg: Record<string, {sid: string; why: string}> = {}
  const tot: Record<string, number> = {}
  sups.forEach(s => (tot[s.id] = 0))
  const ties: {l: Line; sids: string[]}[] = []
  for (const l of r.lines) {
    const q = r.quotes[l.id] || {}
    const offers = sups.filter(s => (q[s.id] || 0) > 0)
    if (!offers.length) continue
    const m = r.pick[l.id]
    if (m && offers.some(s => s.id === m)) asg[l.id] = {sid: m, why: 'Your choice'}
    else if (offers.length === 1) asg[l.id] = {sid: offers[0].id, why: 'Only supplier'}
    else {
      const min = Math.min(...offers.map(s => q[s.id]))
      const w = offers.filter(s => q[s.id] === min)
      if (w.length === 1) asg[l.id] = {sid: w[0].id, why: 'Lowest price'}
      else { ties.push({l, sids: w.map(s => s.id)}); continue }
    }
    tot[asg[l.id].sid] += l.qty * q[asg[l.id].sid]
  }
  const val = (t: {l: Line; sids: string[]}) => t.l.qty * r.quotes[t.l.id][t.sids[0]]
  ties.sort((a, b) => val(b) - val(a))
  for (const t of ties) {
    const sid = t.sids.reduce((a, b) => (tot[b] < tot[a] ? b : a))
    asg[t.l.id] = {sid, why: 'Balanced (same price)'}
    tot[sid] += t.l.qty * r.quotes[t.l.id][sid]
  }
  return {asg, tot}
}

export default function Procure({products, suppliers, setSuppliers, setProducts, reqs, setReqs, notify, exportCSV}: P) {
  const [cur, setCur] = useState(''), [tab, setTab] = useState<'list' | 'prices' | 'orders' | 'receive'>('list')
  const [q, setQ] = useState(''), [hi, setHi] = useState(0), [supName, setSupName] = useState('')
  const [markup, setMarkup] = useState(() => Number(localStorage.getItem('tuuza.markup')) || 1.5)
  const searchRef = useRef<HTMLInputElement>(null)
  const r = reqs.find(x => x.id === cur) || reqs[0]
  const upd = (fn: (r: Req) => Req) => setReqs(old => old.map(x => (x.id === r.id ? fn(x) : x)))

  const idx = useMemo(() => products.filter(p => p.active).map(p => {
    const hay = [p.brandName, p.genericName, p.strength, p.dosageForm].join(' ').toLowerCase()
    return {p, hay, words: hay.split(/[^a-z0-9.]+/).filter(Boolean)}
  }), [products])
  const freq = useMemo(() => { const m = new Map<string, number>(); reqs.forEach(x => x.lines.forEach(l => m.set(l.pid, (m.get(l.pid) || 0) + 1))); return m }, [reqs])
  const sugg = useMemo(() => {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!toks.length) return [] as Medicine[]
    const out: {p: Medicine; s: number}[] = []
    for (const x of idx) {
      let s = 0, ok = true
      for (const t of toks) {
        if (x.hay.includes(t)) s += 2
        else if (t.length >= 4 && x.words.some(w => w.length >= 3 && lev(t, w.slice(0, t.length)) <= 1)) s += 1
        else { ok = false; break }
      }
      if (ok) out.push({p: x.p, s: s + (x.words[0]?.startsWith(toks[0]) ? 1 : 0) + Math.min(freq.get(x.p.id) || 0, 5)})
    }
    return out.sort((a, b) => b.s - a.s).slice(0, 8).map(o => o.p)
  }, [q, idx, freq])

  const newReq = () => {
    const n: Req = {id: `REQ-${new Date().getFullYear()}-${String(reqs.length + 1).padStart(4, '0')}`, date: new Date().toISOString().slice(0, 10), note: '', status: 'Draft', lines: [], quotes: {}, pick: {}, rec: {}}
    setReqs(o => [n, ...o]); setCur(n.id); setTab('list'); setTimeout(() => searchRef.current?.focus(), 50)
  }
  const focusQty = (id: string) => setTimeout(() => { const el = document.querySelector<HTMLInputElement>(`[data-qty="${id}"]`); el?.focus(); el?.select() }, 30)
  const add = (p: Medicine | null) => {
    if (!r) return
    const ex = p && r.lines.find(l => l.pid === p.id)
    const id = ex ? ex.id : uid()
    upd(x => ex ? {...x, lines: x.lines.map(l => (l.id === ex.id ? {...l, qty: l.qty + 1} : l))}
      : {...x, lines: [...x.lines, {id, pid: p ? p.id : 'custom-' + id, name: p ? label(p) : q.trim(), qty: 1}]})
    setQ(''); setHi(0); focusQty(id)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const n = sugg.length + (q.trim() ? 1 : 0)
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, n - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && n) { e.preventDefault(); add(hi < sugg.length ? sugg[hi] : null) }
  }
  const {asg, tot} = useMemo(() => (r ? allocate(r, suppliers) : {asg: {}, tot: {}}), [r, suppliers])
  const sname = (id: string) => suppliers.find(s => s.id === id)?.name || '?'
  const unassigned = r ? r.lines.filter(l => !asg[l.id]) : []
  const priceOf = (l: Line) => r!.quotes[l.id]?.[asg[l.id]?.sid] || 0
  const setPrice = (lid: string, sid: string, v: string) => upd(x => ({...x, status: x.status === 'Draft' ? 'Quoting' : x.status, quotes: {...x.quotes, [lid]: {...(x.quotes[lid] || {}), [sid]: Number(v) || 0}}}))
  const orderRows = (sid: string) => r!.lines.filter(l => asg[l.id]?.sid === sid).map(l => ({product: l.name, quantity: l.qty, unitPrice: priceOf(l), lineTotal: l.qty * priceOf(l)}))
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => notify('Copied to clipboard'), () => notify('Copy failed'))
  const orderText = (sid: string) => { const rows = orderRows(sid); return `*Order ${r!.id} – ${sname(sid)}*\n` + rows.map((x, i) => `${i + 1}. ${x.product} × ${x.quantity} @ ${fmt(x.unitPrice)}`).join('\n') + `\nTotal: ${fmt(tot[sid])} RWF` }
  const setMk = (v: number) => { setMarkup(v); localStorage.setItem('tuuza.markup', String(v)) }
  const recOf = (l: Line) => r!.rec[l.id] ?? {qty: l.qty, cost: priceOf(l)}
  const applyReceipt = () => {
    const m = new Map<string, {qty: number; cost: number}>()
    r!.lines.filter(l => asg[l.id]).forEach(l => m.set(l.pid, recOf(l)))
    setProducts(old => old.map(p => { const v = m.get(p.id); return v ? {...p, unitCost: v.cost, retailPrice: Math.round(v.cost * markup), stock: p.stock + v.qty, updatedAt: new Date().toISOString()} : p }))
    upd(x => ({...x, status: 'Received'})); notify('Stock, cost and retail prices updated')
  }

  if (!r) return <section className="page-wrap"><div className="empty-state"><b>No requisitions yet</b><p>Start a requisition, type product names, then enter supplier prices.</p><button className="btn btn-primary" onClick={newReq}><Plus size={16} /> New requisition</button></div></section>
  const tabs: [typeof tab, string][] = [['list', '1. Requisition'], ['prices', '2. Prices'], ['orders', '3. Orders'], ['receive', '4. Receive & retail']]
  return <section className="page-wrap">
    <div className="page-title-row"><div><div className="eyebrow">PURCHASING WORKFLOW</div><h1>Procurement<span className="accent">.</span></h1></div>
      <div className="page-actions"><select value={r.id} onChange={e => setCur(e.target.value)}>{reqs.map(x => <option key={x.id} value={x.id}>{x.id} · {x.status}</option>)}</select><button className="btn btn-primary" onClick={newReq}><Plus size={16} /> New</button></div></div>
    <div className="proc-tabs">{tabs.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>

    {tab === 'list' && <div className="panel catalogue-panel" style={{padding: 16}}>
      <div style={{position: 'relative'}}>
        <div className="searchbox"><Search size={17} /><input ref={searchRef} autoFocus value={q} onChange={e => { setQ(e.target.value); setHi(0) }} onKeyDown={onKey} placeholder="Type a medicine (e.g. amoxi 500) – ↑↓ then Enter to add" /></div>
        {q.trim() && <div className="sug">{sugg.map((p, i) => <div key={p.id} className={i === hi ? 'on' : ''} onMouseDown={() => add(p)}><b>{label(p)}</b><small>{p.manufacturer}</small></div>)}
          <div className={hi === sugg.length ? 'on' : ''} onMouseDown={() => add(null)}>Add “{q.trim()}” as a custom item</div></div>}
      </div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th></th></tr></thead><tbody>
        {r.lines.map((l, i) => <tr key={l.id}><td>{i + 1}</td><td>{l.name}</td>
          <td><input className="pc" type="number" min={1} data-qty={l.id} value={l.qty} onChange={e => upd(x => ({...x, lines: x.lines.map(y => (y.id === l.id ? {...y, qty: Math.max(1, Number(e.target.value) || 1)} : y))}))} onKeyDown={e => { if (e.key === 'Enter') searchRef.current?.focus() }} /></td>
          <td><button className="icon-btn" aria-label="Remove" onClick={() => upd(x => ({...x, lines: x.lines.filter(y => y.id !== l.id)}))}><Trash2 size={15} /></button></td></tr>)}
      </tbody></table>{!r.lines.length && <p className="small-muted" style={{padding: 16}}>Start typing above to build the list.</p>}</div>
      <div className="modal-actions"><button className="btn btn-secondary" disabled={!r.lines.length} onClick={() => copy(`Requisition ${r.id}\n` + r.lines.map((l, i) => `${i + 1}. ${l.name} × ${l.qty}`).join('\n'))}><Copy size={15} /> Copy for suppliers</button>
        <button className="btn btn-secondary" disabled={!r.lines.length} onClick={() => exportCSV(r.lines.map((l, i) => ({no: i + 1, product: l.name, quantity: l.qty})), `${r.id}-request.csv`)}><Download size={15} /> Export list</button>
        <button className="btn btn-primary" disabled={!r.lines.length} onClick={() => setTab('prices')}>Next: enter prices</button></div>
    </div>}

    {tab === 'prices' && <div className="panel catalogue-panel" style={{padding: 16}}>
      <div className="toolbar"><div className="searchbox"><input value={supName} onChange={e => setSupName(e.target.value)} placeholder="Add supplier name" /></div>
        <button className="btn btn-secondary" disabled={!supName.trim()} onClick={() => { setSuppliers(s => [...s, {id: uid(), name: supName.trim(), contact: '', phone: '', email: '', location: '', notes: ''}]); setSupName('') }}><Plus size={15} /> Add supplier</button></div>
      {!suppliers.length ? <p className="small-muted" style={{padding: 16}}>Add your suppliers, then type each supplier’s price per line. Leave blank if they don’t have it.</p> :
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Qty</th>{suppliers.map(s => <th key={s.id}>{s.name}</th>)}<th>Chosen</th></tr></thead><tbody>
          {r.lines.map(l => { const qs = r.quotes[l.id] || {}; const offers = suppliers.map(s => qs[s.id] || 0).filter(v => v > 0); const min = offers.length > 1 ? Math.min(...offers) : -1
            return <tr key={l.id}><td>{l.name}</td><td>{l.qty}</td>
              {suppliers.map(s => { const v = qs[s.id] || 0, on = asg[l.id]?.sid === s.id
                return <td key={s.id} title={v ? 'Click ✓ to choose this supplier' : ''}><div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                  <input className={`pc ${v && v === min ? 'pc-low' : ''} ${on ? 'pc-on' : ''}`} type="number" min={0} value={v || ''} onChange={e => setPrice(l.id, s.id, e.target.value)} />
                  {v > 0 && <button className="icon-btn" aria-label={`Choose ${s.name}`} onClick={() => upd(x => { const p = {...x.pick}; if (p[l.id] === s.id) delete p[l.id]; else p[l.id] = s.id; return {...x, pick: p} })}><Check size={14} /></button>}</div></td> })}
              <td>{asg[l.id] ? <><b>{sname(asg[l.id].sid)}</b><small className="block-muted">{asg[l.id].why}</small></> : <span className="pill pill-warning">No price</span>}</td></tr> })}
          <tr><td colSpan={2}><b>Total per supplier</b></td>{suppliers.map(s => <td key={s.id}><b>{fmt(tot[s.id] || 0)}</b></td>)}<td></td></tr>
        </tbody></table></div>}
      <p className="small-muted">Green = cheapest. Outlined = chosen. Single-supplier items are assigned automatically, equal prices are balanced across suppliers, and ✓ overrides any line.</p>
      <div className="modal-actions"><button className="btn btn-primary" disabled={!Object.keys(asg).length} onClick={() => setTab('orders')}>Next: orders</button></div>
    </div>}

    {tab === 'orders' && <div>
      {unassigned.length > 0 && <div className="callout"><div><b>{unassigned.length} product(s) have no price yet</b><p>{unassigned.map(l => l.name).join(', ')}</p></div></div>}
      {suppliers.filter(s => tot[s.id] > 0).map(s => <div className="panel catalogue-panel" style={{padding: 16, marginBottom: 12}} key={s.id}>
        <div className="panel-head"><div><h2>{s.name}</h2><p>{orderRows(s.id).length} products · {fmt(tot[s.id])} RWF</p></div>
          <div className="page-actions"><button className="btn btn-secondary" onClick={() => copy(orderText(s.id))}><Copy size={15} /> Copy text</button><button className="btn btn-secondary" onClick={() => exportCSV(orderRows(s.id), `${r.id}-${s.name.replace(/\W+/g, '_')}.csv`)}><Download size={15} /> Export</button></div></div>
        <div className="table-wrap"><table><tbody>{orderRows(s.id).map((x, i) => <tr key={i}><td>{x.product}</td><td>{x.quantity}</td><td>{fmt(x.unitPrice)}</td><td>{fmt(x.lineTotal)}</td></tr>)}</tbody></table></div></div>)}
      {!Object.keys(asg).length && <p className="small-muted">Enter prices first.</p>}
      <div className="modal-actions"><button className="btn btn-primary" disabled={!Object.keys(asg).length} onClick={() => { upd(x => ({...x, status: x.status === 'Received' ? x.status : 'Ordered'})); setTab('receive') }}>Mark ordered → receiving</button></div>
    </div>}

    {tab === 'receive' && <div className="panel catalogue-panel" style={{padding: 16}}>
      <div className="toolbar"><label className="field" style={{margin: 0}}><span>Retail markup (× cost)</span><input type="number" step="0.05" min={1} value={markup} onChange={e => setMk(Number(e.target.value) || 1.5)} /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Product</th><th>Supplier</th><th>Received qty</th><th>Cost</th><th>Retail</th></tr></thead><tbody>
        {r.lines.filter(l => asg[l.id]).map(l => { const v = recOf(l); const set = (patch: Partial<{qty: number; cost: number}>) => upd(x => ({...x, rec: {...x.rec, [l.id]: {...v, ...patch}}}))
          return <tr key={l.id}><td>{l.name}</td><td>{sname(asg[l.id].sid)}</td>
            <td><input className="pc" type="number" min={0} value={v.qty} onChange={e => set({qty: Number(e.target.value) || 0})} /></td>
            <td><input className="pc" type="number" min={0} value={v.cost} onChange={e => set({cost: Number(e.target.value) || 0})} /></td>
            <td><b>{fmt(Math.round(v.cost * markup))}</b></td></tr> })}
      </tbody></table></div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => exportCSV(r.lines.filter(l => asg[l.id]).map(l => ({product: l.name, supplier: sname(asg[l.id].sid), qty: recOf(l).qty, cost: recOf(l).cost, retail: Math.round(recOf(l).cost * markup)})), `${r.id}-retail.csv`)}><Download size={15} /> Export price list</button>
        <button className="btn btn-primary" disabled={r.status === 'Received' || !Object.keys(asg).length} onClick={applyReceipt}>{r.status === 'Received' ? 'Already received' : 'Confirm delivery & update stock'}</button></div>
    </div>}
  </section>
}
