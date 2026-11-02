// cart.html — 购物车：按场次分组展示 + 倒计时 + 删除/清空 + 订票关闭提示。
import { getCart, removeCartItem, clearCart } from '../api/cart.js';
import { getConfig } from '../api/config.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader, updateCartCounter } from '../components/header.js';

const groupsEl = document.getElementById('cart-groups');
const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };
let tz = '';
let timerId = null;
let knownIds = null;         // 上一轮购物车里的条目 id，用来发现“被服务端悄悄移除”的座位
let expectRemoval = false;   // 本人主动删/清空时置 true，避免误报“座位已失效”

function dateTimeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
}

function timeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
}

// 该场次是否已关闭订票：优先用服务端字段，缺字段时用截止时间兜底
function isBookingClosed(session) {
  if (session.isBookingOpen === false) return true;
  if (session.bookingClosesAt && new Date(session.bookingClosesAt) <= new Date()) return true;
  return false;
}

// 扁平 items 按 session.id 分组
function groupBySession(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.session.id;
    if (!map.has(key)) map.set(key, { session: item.session, seats: [] });
    map.get(key).seats.push(item);
  }
  return [...map.values()].sort((a, b) => new Date(a.session.startsAt) - new Date(b.session.startsAt));
}

function renderGroup(g) {
  const closed = isBookingClosed(g.session);
  const subtotal = g.seats.reduce((sum, s) => sum + s.price, 0);

  // 订票关闭的分组是只读的：不渲染删除按钮
  const seats = g.seats.map((s) => `
    <li class="c-cart-seat">
      <span class="c-cart-seat__label">Row ${s.row}, Seat ${s.number}</span>
      <span class="c-badge c-badge--neutral">${s.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
      <span class="c-cart-seat__price">${formatMoney(s.price)}</span>
      ${closed ? '' : `<button class="c-btn c-btn--ghost c-btn--icon c-btn--sm" type="button" aria-label="Remove row ${s.row}, seat ${s.number}" data-cart-item="${s.id}">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-trash"></use></svg>
      </button>`}
    </li>`).join('');

  const errorLine = closed
    ? `<p class="c-cart-group__error" role="alert"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg>Booking closed at ${timeFmt(g.session.bookingClosesAt)}</p>`
    : '';

  return `<section class="c-cart-group${closed ? ' is-error' : ''}">
    <header class="c-cart-group__header">
      <div class="c-cart-group__info">
        <div class="c-poster c-poster--xs"><img class="c-poster__img" src="${g.session.posterUrl}" alt=""></div>
        <div>
          <h2 class="c-cart-group__title"><a href="movie.html?id=${g.session.movieId}">${g.session.movieTitle}</a></h2>
          <p class="c-cart-group__meta">${dateTimeFmt(g.session.startsAt)} · ${g.session.hallName}</p>
        </div>
      </div>
      <span class="c-format">${FORMAT[g.session.format]}</span>
    </header>
    ${errorLine}
    <ul class="c-cart-group__seats">${seats}</ul>
    <footer class="c-cart-group__footer"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></footer>
  </section>`;
}

function startTimer(holdExpiresAt) {
  clearInterval(timerId);
  const el = document.getElementById('cart-timer');
  if (!holdExpiresAt) { el.hidden = true; return; }

  el.hidden = false;
  const tick = () => {
    const left = Math.max(0, Math.floor((new Date(holdExpiresAt) - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    document.getElementById('cart-timer-text').textContent = `Held until ${timeFmt(holdExpiresAt)} · ${mm}:${ss} left`;

    // 剩余不足 2 分钟 / 已过期：用 kit 的状态类表达，不写样式
    el.classList.toggle('is-warning', left > 0 && left < 120);
    el.classList.toggle('is-expired', left <= 0);

    if (left <= 0) { clearInterval(timerId); load(); }
  };
  tick();
  timerId = setInterval(tick, 1000);
}

async function load() {
  const config = await getConfig();
  tz = config.timeZone;
  const cart = await getCart();
  updateCartCounter(cart.ticketsCount);

  document.getElementById('cart-tickets').textContent = cart.ticketsCount;
  document.getElementById('cart-total').textContent = formatMoney(cart.totalPrice);
  startTimer(cart.holdExpiresAt);

  // 锁定过期的座位会被服务端直接移除，这种情况下要明确告诉用户
  const ids = new Set(cart.items.map((i) => i.id));
  if (knownIds && !expectRemoval) {
    const lost = [...knownIds].filter((id) => !ids.has(id));
    if (lost.length > 0) {
      showToast(`${lost.length === 1 ? 'A seat is' : `${lost.length} seats are`} no longer available and ${lost.length === 1 ? 'was' : 'were'} removed from the cart.`, 'danger');
    }
  }
  knownIds = ids;
  expectRemoval = false;

  if (cart.items.length === 0) {
    groupsEl.innerHTML = `<div class="c-empty"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-cart"></use></svg><h2 class="c-empty__title">Your cart is empty</h2><p class="c-empty__text">Pick a movie and choose your seats.</p><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>`;
    return;
  }
  groupsEl.innerHTML = groupBySession(cart.items).map(renderGroup).join('');
}

groupsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-cart-item]');
  if (!btn) return;
  btn.classList.add('is-loading');
  btn.disabled = true;
  try {
    expectRemoval = true;
    await removeCartItem(btn.dataset.cartItem);
    await load();
  } catch (error) {
    expectRemoval = false;
    showToast(error.detail || 'Something went wrong.', 'danger');
  } finally {
    btn.classList.remove('is-loading');
  }
});

document.getElementById('clear-cart').addEventListener('click', async () => {
  if (!confirm('Remove all seats from the cart?')) return;
  try {
    expectRemoval = true;
    await clearCart();
    await load();
  } catch (error) {
    expectRemoval = false;
    showToast(error.detail || 'Something went wrong.', 'danger');
  }
});

initHeader();
load().catch(() => { location.href = 'login.html'; });
