/* Per-account cache + three-way synchronisation. Active keys serve existing screens;
   only this module moves them between account namespaces. No Storage monkey patch. */
const SYNC_KEYS = ['wzb-stats', 'wzb-streak', 'wzb-saved', 'wzb-reports'];
const ACCOUNT_OWNER = 'wzb-data-owner';
let accountSync = null, accountSyncTimer = 0;
const emptyProgress = () => ({ analyses: 0, m: 0, bal: { info: 0, op: 0, emo: 0 }, outlets: [], seen: [], quizzes: 0 });
const emptyAccountData = () => ({ 'wzb-stats': emptyProgress(), 'wzb-streak': [], 'wzb-saved': [], 'wzb-reports': [] });
const accountKey = uid => 'wzb-account:' + (uid || 'local-guest');
const cloneData = value => JSON.parse(JSON.stringify(value));
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; } }
function localBlob() {
  const defaults = emptyAccountData();
  return Object.fromEntries(SYNC_KEYS.map(key => [key, readJSON(key, defaults[key])]));
}
function accountCache(uid) { return readJSON(accountKey(uid), { data: emptyAccountData(), base: {}, dirty: {}, replace: {}, revision: 0 }); }
function applyAccountData(data) {
  const defaults = emptyAccountData();
  for (const key of SYNC_KEYS) localStorage.setItem(key, JSON.stringify(data[key] ?? defaults[key]));
}
function accountActivate(uid) {
  clearTimeout(accountSyncTimer);
  const oldOwner = localStorage.getItem(ACCOUNT_OWNER);
  if (oldOwner) {
    const cache = accountCache(oldOwner === 'local-guest' ? null : oldOwner);
    cache.data = localBlob();
    localStorage.setItem(accountKey(oldOwner === 'local-guest' ? null : oldOwner), JSON.stringify(cache));
  } else if (SYNC_KEYS.some(key => localStorage.getItem(key) !== null)) {
    // Ownership of pre-upgrade data is unknown: retain it, never upload it implicitly.
    if (!localStorage.getItem('wzb-legacy-data')) localStorage.setItem('wzb-legacy-data', JSON.stringify(localBlob()));
  }
  applyAccountData(accountCache(uid).data);
  localStorage.setItem(ACCOUNT_OWNER, uid || 'local-guest');
  localStorage.removeItem('wzb-lastsync');
}
function accountWrite(key, value, replace = false) {
  if (!SYNC_KEYS.includes(key)) throw new Error('Nieznany rodzaj danych konta.');
  const uid = sbSession()?.uid || null;
  if (localStorage.getItem(ACCOUNT_OWNER) !== (uid || 'local-guest')) accountActivate(uid);
  const cache = accountCache(uid);
  cache.data[key] = cloneData(value);
  cache.dirty[key] = ++cache.revision;
  if (replace) cache.replace[key] = true;
  localStorage.setItem(accountKey(uid), JSON.stringify(cache));
  localStorage.setItem(key, JSON.stringify(value));
  clearTimeout(accountSyncTimer);
  if (uid && !sbSession().anonymous) accountSyncTimer = setTimeout(syncNow, 4000);
}
function resetAccountProgress() { for (const [key, value] of Object.entries(emptyAccountData())) accountWrite(key, value, true); }
function mergeList(local = [], remote = [], base = []) {
  const id = item => JSON.stringify(item), localIds = new Set(local.map(id)), baseIds = new Set(base.map(id));
  const removed = new Set(base.filter(item => !localIds.has(id(item))).map(id));
  const result = remote.filter(item => !removed.has(id(item))), seen = new Set(result.map(id));
  for (const item of local) if (!baseIds.has(id(item)) && !seen.has(id(item))) { result.push(item); seen.add(id(item)); }
  return result;
}
function reconcileAccount(cache, remote) {
  const merged = { ...emptyAccountData(), ...remote };
  for (const key of SYNC_KEYS) {
    if (!cache.dirty[key]) continue;
    const local = cache.data[key], base = cache.base[key];
    if (cache.replace[key]) { merged[key] = cloneData(local); continue; }
    if (key !== 'wzb-stats') { merged[key] = mergeList(local, remote[key], base); continue; }
    const before = base || emptyProgress(), other = remote[key] || emptyProgress();
    const delta = (a, b, c) => Math.max(0, (+c || 0) + (+a || 0) - (+b || 0));
    merged[key] = { ...other, ...local, analyses: delta(local.analyses, before.analyses, other.analyses),
      quizzes: delta(local.quizzes, before.quizzes, other.quizzes), m: Math.min(30, delta(local.m, before.m, other.m)),
      bal: Object.fromEntries(['info', 'op', 'emo'].map(k => [k, delta(local.bal?.[k], before.bal?.[k], other.bal?.[k])])),
      outlets: mergeList(local.outlets, other.outlets, before.outlets), seen: mergeList(local.seen, other.seen, before.seen).slice(-200) };
  }
  merged['wzb-reports'] = merged['wzb-reports'].slice(-100);
  return merged;
}
function accountDevice() {
  let id = localStorage.getItem('wzb-device-id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('wzb-device-id', id); }
  return id;
}
function finishAccountSync(uid, sent, merged) {
  const latest = accountCache(uid);
  const rebased = reconcileAccount({ ...latest, base: sent.data }, merged);
  latest.base = cloneData(merged);
  for (const key of SYNC_KEYS) {
    if (latest.dirty[key] === sent.dirty[key]) { latest.data[key] = merged[key]; delete latest.dirty[key]; delete latest.replace[key]; }
    else latest.data[key] = rebased[key];
  }
  delete latest.pending;
  localStorage.setItem(accountKey(uid), JSON.stringify(latest));
  const changed = JSON.stringify(localBlob()) !== JSON.stringify(latest.data);
  applyAccountData(latest.data);
  localStorage.setItem('wzb-lastsync', String(Date.now()));
  if (changed && typeof render === 'function') render(current);
  if (Object.keys(latest.dirty).length) accountSyncTimer = setTimeout(syncNow, 500);
}
async function syncNow() {
  const session = sbSession(), version = sessionVersion();
  if (!session || session.anonymous) return false;
  if (accountSync?.version === version) return accountSync.promise;
  const pending = { version };
  const work = async () => {
    try {
      requireSessionVersion(version);
      const token = await sbToken(); requireSessionVersion(version);
      if (!token) return false;
      const device = accountDevice();
      for (let attempt = 0; attempt < 3; attempt++) {
        const rows = await sbReq('/rest/v1/user_data?select=data,updated_at&user_id=eq.' + encodeURIComponent(session.uid), { token });
        requireSessionVersion(version);
        if (!Array.isArray(rows) || rows.length > 1) throw new Error('Niepoprawna odpowiedź synchronizacji.');
        const remote = rows[0]?.data || {}, cache = accountCache(session.uid);
        // Keep the operation until its acknowledgement has been saved locally.
        // A lost HTTP response must not count the same progress twice on retry.
        const operation = cache.pending || { id: crypto.randomUUID(), snapshot: cloneData(cache) };
        if (cache.pending && remote.__wzbReceipts?.[device] === operation.id) {
          finishAccountSync(session.uid, operation.snapshot, remote);
          return true;
        }
        const merged = reconcileAccount(operation.snapshot, remote);
        if (JSON.stringify(merged) !== JSON.stringify(remote)) {
          merged.__wzbReceipts = { ...remote.__wzbReceipts, [device]: operation.id };
          cache.pending = operation;
          localStorage.setItem(accountKey(session.uid), JSON.stringify(cache));
          // Update only the version just read; retry a conflicting insert/update.
          const updated = rows.length
            ? await sbReq('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(session.uid) + '&updated_at=eq.' + encodeURIComponent(rows[0].updated_at),
              { method: 'PATCH', token, prefer: 'return=representation', body: { data: merged, updated_at: new Date(Math.max(Date.now(), Date.parse(rows[0].updated_at) + 1)).toISOString() } })
            : await sbReq('/rest/v1/user_data?on_conflict=user_id', { method: 'POST', token, prefer: 'resolution=ignore-duplicates,return=representation', body: { user_id: session.uid, data: merged, updated_at: new Date().toISOString() } });
          requireSessionVersion(version);
          if (!Array.isArray(updated) || !updated.length) continue;
        }
        finishAccountSync(session.uid, operation.snapshot, merged);
        return true;
      }
      return false;
    } catch (_) { return false; }
  };
  pending.promise = (async () => {
    try { return navigator.locks ? await navigator.locks.request('wzb-sync', work) : await work(); }
    finally { if (accountSync === pending) accountSync = null; }
  })();
  accountSync = pending;
  return pending.promise;
}
function initAccountData() {
  accountActivate(sbSession()?.uid || null);
  setTimeout(() => { if (sbSession()) syncNow(); }, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  addEventListener('storage', event => {
    if (event.key === SB_SESSION) {
      invalidateAccountRequests();
      if (localStorage.getItem(ACCOUNT_OWNER) !== (sbSession()?.uid || 'local-guest')) accountActivate(sbSession()?.uid || null);
      let previous = null; try { previous = JSON.parse(event.oldValue || 'null'); } catch (_) {}
      if (typeof onAccountSessionChange === 'function') onAccountSessionChange(previous, sbSession());
      if (typeof render === 'function') render(current);
    }
  });
}
