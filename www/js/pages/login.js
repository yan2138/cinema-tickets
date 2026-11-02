// login.html — 登录：提交 → 存 token → 跳转；失败展示 c-alert。
import { login, getProfile } from '../api/account.js';
import { isLoggedIn, clearTokens } from '../api/auth.js';
import { initHeader } from '../components/header.js';

const form = document.getElementById('login-form');
const params = new URLSearchParams(location.search);

// returnUrl 只接受本站相对路径，挡住 `//evil.com` 这类协议相对地址（开放重定向）
function safeReturnUrl(value) {
  if (!value) return 'index.html';
  if (!value.startsWith('/') || value.startsWith('//')) return 'index.html';
  return value;
}

const returnUrl = safeReturnUrl(params.get('returnUrl'));

// 已登录用户不该停留在登录页（需求 5.2）：先确认 token 仍有效，再跳首页
async function redirectIfLoggedIn() {
  if (!isLoggedIn()) return false;
  try {
    await getProfile();
    location.replace('index.html');
    return true;
  } catch {
    clearTokens();   // 本地 token 已失效：留在本页正常登录
    return false;
  }
}

function showError(message) {
  let alert = form.querySelector('.c-alert');
  if (!alert) {
    alert = document.createElement('div');
    alert.className = 'c-alert c-alert--danger';
    alert.setAttribute('role', 'alert');
    form.prepend(alert);
  }
  alert.innerHTML = `<svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><div class="c-alert__body"><p>${message}</p></div>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = form.elements.email.value;
  const password = form.elements.password.value;
  const btn = form.querySelector('button[type="submit"]');

  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  try {
    await login(email, password);
    location.href = returnUrl;
  } catch (error) {
    showError(error.detail || 'The server is unavailable. Try again later.');
    form.elements.password.value = '';
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
  }
});

initHeader();
redirectIfLoggedIn();
