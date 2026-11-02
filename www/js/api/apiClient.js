// js/api/apiClient.js
// 整个项目唯一和后台对话的地方。所有页面只调用 request()，绝不直接 fetch，
// 这样「加鉴权头、JSON 解析、401 自动刷新后重试」都只写一份。

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth.js';

export const API_BASE = 'https://api.cinema.int.hardcoder.ru';
// 非 2xx 响应统一抛出的错误，携带 ProblemDetails 的字段。
export class ApiError extends Error {
  constructor({ status, code, title, detail, errors, affectedIds }) {
    super(detail || title || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;      // HTTP 状态码
    this.code = code;          // 业务码，如 UNAUTHORIZED / INVALID_CREDENTIALS / VALIDATION_ERROR
    this.detail = detail;      // 直接展示给用户的话术
    this.errors = errors;      // 表单校验错误：字段名 -> 错误数组
    this.affectedIds = affectedIds;
  }
}

// 把 Response 转成 ApiError。body 可能是 JSON，也可能不是。
async function toApiError(response) {
  let body = null;
  try { body = await response.json(); } catch { /* 非 JSON，忽略 */ }
  return new ApiError({
    status: response.status,
    code: body?.code,
    title: body?.title,
    detail: body?.detail,
    errors: body?.errors,
    affectedIds: body?.affectedIds,
  });
}

// ---------- 401 刷新（single-flight） ----------
// 并发场景：多个请求同时 401，refreshToken 只能用一次，所以只发一次刷新，
// 其它请求 await 同一个 Promise。刷新成功后再各自重放自己的请求。

let refreshInFlight = null;

function refreshTokens() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      // 注意：这里必须用裸 fetch，不能走 request()，
      // 否则刷新自己 401 时又会触发刷新，形成死循环。
      const response = await fetch(`${API_BASE}/api/account/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // 刷新也失败：token 彻底失效，清空并强制重新登录。
        clearTokens();
        throw await toApiError(response);
      }

      const data = await response.json();
      setTokens(data); // 存下新的 accessToken + refreshToken
      return data;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// 单次请求：加鉴权头、序列化 body、拼 query、抛 ApiError。
async function doFetch(path, { method = 'GET', body, query, headers } = {}) {
  const url = new URL(path, API_BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const init = { method, headers: { ...headers } };
  const accessToken = getAccessToken();
  if (accessToken) init.headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return null;
  return response.json();
}

// 对外唯一的请求入口。
export async function request(path, options) {
  try {
    return await doFetch(path, options);
  } catch (error) {
    // 只有「带 refreshToken 的受保护请求」401 才刷新重试；
    // 游客没有 refreshToken，直接把 401 抛给调用方。
    if (error instanceof ApiError && error.status === 401 && getRefreshToken()) {
      await refreshTokens();                 // 失败会在这里抛出，不会走到下一行
      return await doFetch(path, options);   // 只重试一次，再 401 直接抛
    }
    throw error;
  }
}
