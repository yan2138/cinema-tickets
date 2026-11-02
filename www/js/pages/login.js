// login.html — 登录：提交 → 存 token → 跳转；失败展示 c-alert。
import { login } from '../api/account.js';
import { initHeader } from '../components/header.js';

const form = document.getElementById('login-form');
const params = new URLSearchParams(location.search);
const returnUrl = params.get('returnUrl');

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
    location.href = returnUrl || 'index.html';
  } catch (error) {
    showError(error.detail || 'The server is unavailable. Try again later.');
    form.elements.password.value = '';
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
  }
});

initHeader();
