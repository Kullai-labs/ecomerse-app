const API = '/api'

export async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const apiGet = (path: string) => api(path)
export const apiPost = (path: string, body: any) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const apiPut = (path: string, body: any) => api(path, { method: 'PUT', body: JSON.stringify(body) })
export const apiPatch = (path: string, body: any) => api(path, { method: 'PATCH', body: JSON.stringify(body) })
export const apiDelete = (path: string) => api(path, { method: 'DELETE' })
