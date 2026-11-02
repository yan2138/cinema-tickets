// js/components/header.js — 每个页面都要调用 initHeader()
// 作用：根据登录态渲染右上角用户区，并拉取购物车角标数字。
import { isLoggedIn, clearTokens } from '../api/auth.js';
import { getProfile } from '../api/account.js';
import { logout } from '../api/account.js';
import { getCart } from '../api/cart.js';

export async function initHeader() {
  const userArea = document.querySelector('.c-header__user');
  if (!userArea) return;

  if (!isLoggedIn()) return;   // 游客：保持静态 HTML 里的 Log in / Register

  try {
    const profile = await getProfile();
    userArea.innerHTML = `
      <a class="c-header__email" href="profile.html">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-user"></use></svg>${profile.email}
      </a>
      <button class="c-btn c-btn--ghost c-btn--sm" type="button" id="header-logout">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-logout"></use></svg>Log out
      </button>`;

    userArea.querySelector('#header-logout').addEventListener('click', async () => {
      await logout();
      location.href = 'index.html';
    });
  } catch {
    // token 失效且刷新也失败：清空并回登录页
    clearTokens();
    location.href = 'login.html';
  }

  // 购物车角标
  try {
    const cart = await getCart();
    updateCartCounter(cart.ticketsCount ?? 0);
  } catch { /* 角标失败不影响页面 */ }
}

export function updateCartCounter(count) {
  const counter = document.querySelector('.c-counter');
  if (!counter) return;
  if (count > 0) {
    counter.textContent = count;
    counter.removeAttribute('hidden');
  } else {
    counter.setAttribute('hidden', '');
  }
}
