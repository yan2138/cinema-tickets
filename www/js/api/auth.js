// js/api/auth.js
// Token 存取。只做 localStorage 读写，不发任何网络请求。
// 登录 / 注册 / 刷新接口返回的 token 结构一致：
//   { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }

const ACCESS_KEY = 'cinema.accessToken';
const REFRESH_KEY = 'cinema.refreshToken';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

// 存一对新 token（登录 / 注册 / 刷新成功后都会调用）。
export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isLoggedIn() {
  return Boolean(getAccessToken());
}
