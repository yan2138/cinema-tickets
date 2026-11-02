// js/api/account.js — 账号相关接口
import { request } from './apiClient.js';
import { getRefreshToken, setTokens, clearTokens } from './auth.js';

export async function login(email, password) {
  const data = await request('/api/account/login', {
    method: 'POST',
    body: { email, password },
  });
  setTokens(data);   // 成功后存一对新 token
  return data;
}

export async function register(payload) {
  const data = await request('/api/account/register', {
    method: 'POST',
    body: payload,
  });
  setTokens(data);
  return data;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await request('/api/account/logout', {
        method: 'POST',
        body: { refreshToken },
      });
    } catch { /* 登出接口失败也照样清本地 token */ }
  }
  clearTokens();
}

export function getProfile() {
  return request('/api/account/profile');
}

export function updateProfile(payload) {
  return request('/api/account/profile', { method: 'PUT', body: payload });
}
