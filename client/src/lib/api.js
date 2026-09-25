const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;
const TOKEN_KEY = 'ledgerly-token';

export const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

function qs(params) {
  if (!params) return '';
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export async function request(method, path, { body, params, raw } = {}) {
  const headers = { 'x-timezone': tz };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection.');
  }
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.fields);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p, params) => request('GET', p, { params }),
  post: (p, body) => request('POST', p, { body: body ?? {} }),
  patch: (p, body) => request('PATCH', p, { body }),
  del: (p, params) => request('DELETE', p, { params }),
};

/** Download an authenticated file (CSV exports). */
export async function download(path, params, fallbackName) {
  const res = await request('GET', path, { params, raw: true });
  const blob = await res.blob();
  const name = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
