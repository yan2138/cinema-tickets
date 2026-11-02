// cart.html — 购物车：按场次分组展示 + 倒计时 + 删除/清空。
import { getCart, removeCartItem, clearCart } from '../api/cart.js';
import { getConfig } from '../api/config.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader, updateCartCounter } from '../components/header.js';

const groupsEl = document.getElementById('cart-groups');
const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };
let tz = '';
let timerId = null;

function dateTimeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
}

function timeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
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
  const seats = g.seats.map((s) => `
    <li class="c-cart-seat">
      <span class="c-cart-seat__label">Row ${s.row}, Seat ${s.number}</span>
      <span class="c-badge c-badge--neutral">${s.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
      <span class="c-cart-seat__price">${formatMoney(s.price)}</span>
      <button class="c-btn c-btn--ghost c-btn--icon c-btn--sm" type="button" aria-label="Remove row ${s.row}, seat ${s.number}" data-cart-item="${s.id}">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-trash"></use></svg>
      </button>
    </li>`).join('');

  return `<section class="c-cart-group">
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
    <ul class="c-cart-group__seats">${seats}</ul>
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

  if (cart.items.length === 0) {
    groupsEl.innerHTML = `<div class="c-empty"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-cart"></use></svg><h2 class="c-empty__title">Your cart is empty</h2><p class="c-empty__text">Pick a movie and choose your seats.</p><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>`;
    return;
  }
  groupsEl.innerHTML = groupBySession(cart.items).map(renderGroup).join('');
}

groupsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-cart-item]');
  if (!btn) return;
  try {
    await removeCartItem(btn.dataset.cartItem);
    await load();
  } catch (error) {
    showToast(error.detail || 'Something went wrong.', 'danger');
  }
});

document.getElementById('clear-cart').addEventListener('click', async () => {
  await clearCart();
  await load();
});

initHeader();
load().catch(() => { location.href = 'login.html'; });
