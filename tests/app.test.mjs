import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { demo, empty, balance, monthly, localDate, validate } from '../dist/core.mjs';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const currentMonth = localDate().slice(0, 7);
const storageKey = 'ruanguang-v1-demo';
let dom, errors, downloads, confirmations, allowConfirm, failStorage, sequence = 0;
const originals = new Map();
function bind(key, value) {
  if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
async function boot({ data = demo(currentMonth), raw, mode = 'demo', personal } = {}) {
  dom?.window.close();
  dom = new JSDOM(html, { url: 'https://ruanguang.test/' });
  errors = []; downloads = []; confirmations = []; allowConfirm = true; failStorage = false;
  const w = dom.window;
  w.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const store = w.localStorage;
  store.setItem('ruanguang-mode', mode);
  if (raw !== undefined) store.setItem(storageKey, raw);
  else if (data) store.setItem(storageKey, JSON.stringify(data));
  if (personal) store.setItem('ruanguang-v1-personal', JSON.stringify(personal));
  const storage = {
    getItem: key => store.getItem(key),
    setItem: (key, value) => { if (failStorage) throw Error('QuotaExceededError'); store.setItem(key, value); }
  };
  for (const [key, value] of Object.entries({ window: w, document: w.document, location: w.location, localStorage: storage, FormData: w.FormData, confirm: message => { confirmations.push(message); return allowConfirm; }, setTimeout: () => 0, clearTimeout: () => {} })) bind(key, value);
  const blobs = new Map();
  bind('URL', class extends URL {
    static createObjectURL(blob) { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; }
    static revokeObjectURL() {}
  });
  w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, blob: blobs.get(this.href) }); };
  await import(`../dist/app.mjs?test=${++sequence}`);
}
function $(selector) { const e = document.querySelector(selector); assert(e, `Element missing: ${selector}`); return e; }
function click(selector) { $(selector).click(); }
function value(selector, value, event = 'change') { const e = $(selector); e.value = String(value); e.dispatchEvent(new dom.window.Event(event, { bubbles: true })); }
function go(page) { dom.reconfigure({ url: `https://ruanguang.test/#${page}` }); window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')); }
function edit(kind, id) { click(`[data-action="${kind}"]${id ? `[data-id="${id}"]` : ':not([data-id])'}`); }
function submit(fields) {
  for (const [name, v] of Object.entries(fields)) value(`#editor [name="${name}"]`, v);
  const f = $('#editor');
  if (f.checkValidity()) f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}
function state(mode = 'demo') { return JSON.parse(localStorage.getItem(`ruanguang-v1-${mode}`)); }
function text() { return $('#page').textContent; }
function toast() { return $('#toast').textContent; }
function remove(collection, id) { click(`[data-action="delete"][data-collection="${collection}"][data-id="${id}"]`); }
async function importFile(content, size = content.length) {
  Object.defineProperty($('#import-file'), 'files', { configurable: true, value: [{ size, text: async () => content }] });
  $('#import-file').dispatchEvent(new dom.window.Event('change'));
  await new Promise(resolve => setImmediate(resolve));
}
function totals(s) { return s.accounts.reduce((n, a) => n + balance(s, a.id), 0); }
beforeEach(async () => { await boot(); });
afterEach(() => {
  const found = errors;
  dom?.window.close();
  for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  originals.clear();
  assert.deepEqual(found, [], 'No uncaught application errors');
});

test('Every navigation section renders; unknown route falls back to dashboard', () => {
  for (const [page, heading] of Object.entries({ dashboard: 'Halo, Agus', transactions: 'Semua transaksi', accounts: 'Rekening & dompet', budgets: 'Anggaran bulanan', goals: 'Target tabungan', bills: 'Tagihan rutin', reports: 'Laporan keuangan', settings: 'Pengaturan & data' })) {
    go(page); assert($('#page h1').textContent.includes(heading));
    assert.equal($('nav [aria-current="page"]').getAttribute('href'), `#${page}`);
  }
  go('unknown'); assert.match(text(), /Halo, Agus/);
});
test('Expense create/edit/delete updates account balances and monthly totals', () => {
  const before = state(); edit('transaction'); submit({ amount: 25000, note: 'QA coffee' });
  let s = state(); let tx = s.transactions.at(-1); assert.equal(totals(s), totals(before) - 25000);
  assert.equal(monthly(s,currentMonth).expense, monthly(before,currentMonth).expense + 25000);
  edit('transaction',tx.id); submit({ amount: 35000, note: 'QA coffee edited' });
  assert.equal(totals(state()), totals(before) - 35000);
  remove('transactions',tx.id); assert.equal(totals(state()), totals(before));
});
test('Income creation and editing category update income without affecting expense', () => {
  const before = monthly(state(), currentMonth); edit('transaction');
  submit({ type: 'income', amount: 150000, category: 'freelance', note: 'QA income' });
  assert.equal(monthly(state(), currentMonth).income, before.income + 150000);
  assert.equal(monthly(state(), currentMonth).expense, before.expense);
});
test('Transfer excludes its source from destinations and conserves total cashflow', () => {
  const before = state(); edit('transaction'); value('#editor [name="type"]', 'transfer');
  assert(!Array.from($('#editor [name="to"]').options).some(o => o.value === 'bank'));
  submit({ amount: 120000, to: 'cash', note: 'QA transfer' });
  const s = state(); assert.equal(totals(s), totals(before));
  assert.equal(balance(s,'bank'),balance(before,'bank') - 120000);
  assert.equal(balance(s,'cash'),balance(before,'cash') + 120000);
  assert.equal(monthly(s,currentMonth).expense,monthly(before,currentMonth).expense);
  assert.equal(monthly(s,currentMonth).income,monthly(before,currentMonth).income);
});
test('Invalid amounts and cancelled forms never change storage', () => {
  const before = localStorage.getItem(storageKey); edit('transaction');
  for (const amount of ['0','-1','1.5','1000000000001','']) { submit({ amount }); assert.equal(localStorage.getItem(storageKey),before); }
  click('[data-action="close"]'); assert(!$('#modal').open);
});
test('One-account transfer cannot be saved', async () => {
  await boot({ data: empty() }); edit('transaction'); submit({ type: 'transfer', amount: 1000 });
  assert.equal(state().transactions.length,0); assert($('#modal').open);
});
test('Search, type/account filters, incoming transfer filter and month selection', () => {
  go('transactions'); value('#search','gaji','input'); assert.equal(document.querySelectorAll('tbody tr').length,1);
  value('#search','','input'); value('#type-filter','transfer'); value('#account-filter','wallet');
  assert.equal(document.querySelectorAll('tbody tr').length,1); assert.match(text(),/Isi dompet digital/);
  value('#month','2020-01'); assert.match(text(),/0 transaksi ditampilkan/);
});
test('Changing transaction date moves it to the selected reporting month', () => {
  const tx=state().transactions[0], before=monthly(state(),currentMonth).income;
  go('transactions'); edit('transaction',tx.id); submit({ date:'2020-01-05' });
  assert.equal(monthly(state(),currentMonth).income,before-tx.amount);
  value('#month','2020-01'); assert.match(text(),/Gaji bulanan/);
});
test('Account create, edit opening balance, delete unused and protect used/last account', async () => {
  go('accounts'); edit('account'); submit({ name:'QA savings', kind:'bank', opening:500000 });
  const a=state().accounts.at(-1); assert.equal(balance(state(),a.id),500000);
  edit('account',a.id); submit({ name:'QA savings updated', opening:600000 }); assert.equal(balance(state(),a.id),600000);
  remove('accounts',a.id); assert(!state().accounts.some(x=>x.id===a.id));
  remove('accounts','bank'); assert.match(toast(),/tidak dapat dihapus/);
  await boot({data:empty()}); go('accounts'); remove('accounts','cash'); assert.equal(state().accounts.length,1);
});
test('Budget create/edit/delete, duplicate prevention, over-budget and monthly isolation', () => {
  go('budgets'); edit('budget'); submit({category:'health',limit:100000});
  const b=state().budgets.at(-1); assert.match(text(),/Melebihi anggaran/);
  edit('budget'); submit({category:'health',limit:200000}); assert.match($('#form-error').textContent,/sudah memiliki/);
  click('[data-action="close"]'); edit('budget',b.id); submit({limit:300000}); assert.equal(state().budgets.at(-1).limit,300000);
  remove('budgets',b.id); assert(!state().budgets.some(x=>x.id===b.id));
  value('#month','2020-01'); assert.match(text(),/Belum ada anggaran/);
});
test('Goal create/edit/top-up/delete conserves account balance and prevents over-allocation', () => {
  const total=totals(state()); go('goals'); edit('goal'); submit({name:'QA laptop',target:1000000,saved:100000,deadline:'2027-01-01'});
  const g=state().goals.at(-1); edit('goal',g.id); submit({name:'QA laptop updated',target:1200000});
  edit('topup',g.id); submit({amount:200000}); assert.equal(state().goals.at(-1).saved,300000); assert.equal(totals(state()),total);
  edit('topup',g.id); submit({amount:1000000}); assert.match($('#form-error').textContent,/melebihi/);
  click('[data-action="close"]'); edit('goal',g.id); submit({target:100000}); assert.match($('#form-error').textContent,/melebihi/);
  click('[data-action="close"]'); remove('goals',g.id); assert(!state().goals.some(x=>x.id===g.id));
});
test('Bill CRUD/payment: short-month clamp, one payment per month, unlink deletion retains ledger', () => {
  go('bills'); value('#month','2026-02'); edit('bill'); submit({name:'QA bill',amount:50000,day:31,account:'bank',category:'bills'});
  const b=state().bills.at(-1); edit('bill',b.id); submit({name:'QA bill updated',amount:60000});
  click(`[data-action="pay"][data-id="${b.id}"]`);
  let s=state(), tx=s.transactions.find(t=>t.billId===b.id); assert.equal(tx.date,'2026-02-28'); assert.equal(tx.amount,60000);
  assert.equal(document.querySelector(`[data-action="pay"][data-id="${b.id}"]`),null);
  assert.deepEqual(s.bills.at(-1).paid,['2026-02']);
  remove('bills',b.id); s=state(); assert(s.transactions.some(t=>t.id===tx.id)); assert(!s.transactions.find(t=>t.id===tx.id).billId); validate(s);
});
test('Deleting bill payment reopens month; editing it cannot change type or month', () => {
  go('bills'); const b=state().bills[0]; click(`[data-action="pay"][data-id="${b.id}"]`);
  const tx=state().transactions.find(t=>t.billId===b.id); go('transactions'); edit('transaction',tx.id);
  submit({date:'2020-01-01'}); assert.match($('#form-error').textContent,/catat ulang/);
  click('[data-action="close"]'); edit('transaction',tx.id); submit({type:'income'}); assert.match($('#form-error').textContent,/catat ulang/);
  click('[data-action="close"]'); remove('transactions',tx.id); assert.deepEqual(state().bills[0].paid,[]);
  go('bills'); assert(document.querySelector(`[data-action="pay"][data-id="${b.id}"]`));
});
test('Cancelled deletion and cancelled bill payment preserve all records', () => {
  const before=localStorage.getItem(storageKey); allowConfirm=false; go('transactions'); remove('transactions',state().transactions[0].id);
  go('bills'); click(`[data-action="pay"][data-id="${state().bills[0].id}"]`); assert.equal(localStorage.getItem(storageKey),before);
});
test('Reports totals agree with ledger; no-income/empty months render without NaN', () => {
  go('reports'); const m=monthly(state(),currentMonth); assert.equal(document.querySelectorAll('.metrics .metric').length,3);
  assert(text().includes(new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(m.net)));
  value('#month','2020-01'); assert.match(text(),/Belum ada pengeluaran/); assert(!text().includes('NaN'));
});
test('Profile name escapes markup; custom category is usable and duplicates are rejected', () => {
  go('settings'); value('[name="name"]','<b>QA</b>'); $('#profile-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(state().name,'<b>QA</b>'); go('dashboard'); assert.equal(document.querySelector('h1 b'),null);
  go('settings'); edit('category'); submit({name:'QA transport',type:'expense'}); const c=state().categories.at(-1);
  edit('category'); submit({name:'qa TRANSPORT',type:'expense'}); assert.match($('#form-error').textContent,/sudah ada/);
  click('[data-action="close"]'); go('transactions'); edit('transaction'); submit({amount:5000,category:c.id}); assert.equal(state().transactions.at(-1).category,c.id);
});
test('Demo/personal isolation, reload persistence and reset demo preserve personal ledger', async () => {
  const p=empty(); p.name='Personal QA'; await boot({personal:p}); click('#mode-button'); assert.match(text(),/Personal QA/); assert($('#demo-banner').hidden);
  edit('transaction'); submit({amount:1234,note:'Personal expense'}); const saved=state('personal');
  click('#mode-button'); assert.equal(state().name,'Agus'); go('settings'); click('[data-action="reset-demo"]'); assert.deepEqual(state('personal'),saved);
  await boot({data:state(),personal:saved,mode:'personal'}); assert.match(text(),/Personal expense/);
});
test('Hide amounts masks visible nominal values and chart tooltips; toggle restores', () => {
  click('[data-action="visibility"]'); assert.match(text(),/Rp ••••••/);
  for(const e of document.querySelectorAll('.bar[title]')) assert(e.title.includes('••••••'));
  assert(!/Rp\s*[0-9]/.test(text())); click('[data-action="visibility"]'); assert(/Rp\s*[0-9]/.test(text()));
});
test('Mobile menu toggles aria-expanded and navigation closes it', () => {
  click('#mobile-menu'); assert.equal($('#mobile-menu').getAttribute('aria-expanded'),'true'); assert(document.body.classList.contains('nav-open'));
  go('accounts'); assert.equal($('#mobile-menu').getAttribute('aria-expanded'),'false'); assert(!document.body.classList.contains('nav-open'));
});
test('JSON backup contains all data; filtered CSV contains only matching transaction', async () => {
  go('settings'); click('[data-action="backup"]'); assert.deepEqual(JSON.parse(await downloads[0].blob.text()),state()); assert(downloads[0].name.endsWith('.json'));
  go('transactions'); value('#search','gaji','input'); click('[data-action="csv"]'); const file=await downloads[1].blob.text();
  assert(file.includes('Gaji bulanan')); assert(!file.includes('Internet rumah')); assert.equal(file.trim().split('\r\n').length,2);
});
test('Valid backup import restores complete state; cancellation, malformed/oversize/invalid input preserve data', async () => {
  const before=localStorage.getItem(storageKey); await importFile('{'); assert.equal(localStorage.getItem(storageKey),before); assert.match(toast(),/Impor ditolak/);
  await importFile('{}',10000001); assert.match(toast(),/maksimum/); assert.equal(localStorage.getItem(storageKey),before);
  await importFile('{}'); assert.equal(localStorage.getItem(storageKey),before);
  const next=empty(); next.name='Restored QA'; allowConfirm=false; await importFile(JSON.stringify(next)); assert.equal(localStorage.getItem(storageKey),before);
  allowConfirm=true; await importFile(JSON.stringify(next)); assert.deepEqual(state(),next); assert.match(toast(),/berhasil dipulihkan/);
});
test('Corrupt stored data is not overwritten; valid backup can recover', async () => {
  await boot({raw:'broken-json'}); assert.match(toast(),/tidak bisa dibaca/);
  edit('transaction'); submit({amount:1000}); assert.equal(localStorage.getItem(storageKey),'broken-json'); assert.match(toast(),/Gagal menyimpan/);
  await importFile(JSON.stringify(empty())); assert.deepEqual(state(),empty());
});
test('Storage quota failures do not report success or change ledger for form, profile, delete, payment', () => {
  const before=localStorage.getItem(storageKey); failStorage=true; edit('transaction'); submit({amount:1000}); assert.match(toast(),/Gagal menyimpan/); assert($('#modal').open);
  click('[data-action="close"]'); go('settings'); value('[name="name"]','Changed'); $('#profile-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})); assert.match(toast(),/Gagal menyimpan/);
  go('transactions'); remove('transactions',state().transactions[0].id); assert.match(toast(),/Gagal menyimpan/);
  go('bills'); click(`[data-action="pay"][data-id="${state().bills[0].id}"]`); assert.match(toast(),/Gagal menyimpan/); assert.equal(localStorage.getItem(storageKey),before);
});

test('Unknown stored mode falls back to demo without mixing personal data', async () => {
  const personal=empty(); personal.name='Personal only';
  await boot({mode:'invalid-mode',personal});
  assert.match(text(),/Halo, Agus/); assert.equal($('#mode-button').textContent,'Mode demo');
  assert.equal(state('personal').name,'Personal only');
});
