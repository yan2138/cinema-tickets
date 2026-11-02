// js/utils/ui.js — 通用 UI 工具：toast 通知
// toast 需要页面里有一个 <div class="c-toast-stack"></div> 容器。

export function showToast(message, type = 'info') {
  const stack = document.querySelector('.c-toast-stack');
  if (!stack) return;

  const icons = { success: 'icon-check', danger: 'icon-error', info: 'icon-info' };
  const icon = icons[type] || icons.info;

  const toast = document.createElement('div');
  toast.className = `c-toast c-toast--${type}`;
  toast.innerHTML = `
    <svg class="c-icon c-toast__icon" aria-hidden="true"><use href="../kit/icons.svg#${icon}"></use></svg>
    <span class="c-toast__text"></span>
    <button class="c-toast__close" type="button" aria-label="Close">
      <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-close"></use></svg>
    </button>`;

  toast.querySelector('.c-toast__text').textContent = message;
  toast.querySelector('.c-toast__close').addEventListener('click', () => toast.remove());

  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);   // 5 秒后自动消失
}
