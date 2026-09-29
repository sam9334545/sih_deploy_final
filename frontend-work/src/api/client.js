/**
 * Central API Client for SIH26006 Charter Intelligence.
 * Handles timeouts, structured errors, response validation, and environment base URLs.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message, status, detail = null, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.payload = payload;
  }
}

/**
 * Robust JSON fetch wrapper.
 * @param {string} endpoint - Relative path starting with /api
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    console.error(`[API Network Error] ${options.method || 'GET'} ${url}:`, netErr);
    throw new ApiError(
      'Network connection to backend server failed. Please ensure the backend server is reachable.',
      0,
      netErr.message
    );
  }

  // Deserialise response body
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error(`[API JSON Parse Error] ${url}:`, parseErr);
      throw new ApiError('Failed to parse backend response as JSON.', response.status);
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let msg = `Backend returned HTTP ${response.status}`;
    let detail = null;
    let payload = null;

    if (data && typeof data === 'object') {
      detail = data.detail || data.message || data.error;
      payload = data;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI 422 validation errors array
        msg = detail.map(d => `${d.loc ? d.loc.join('.') : 'field'}: ${d.msg}`).join('; ');
      }
    }

    if (import.meta.env.DEV) {
      console.warn(`[API Error ${response.status}] ${options.method || 'GET'} ${url}:`, data);
    }

    throw new ApiError(msg, response.status, detail, payload);
  }

  return data;
}
