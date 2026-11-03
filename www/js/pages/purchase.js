// purchase.html — 结算：联系人 + 支付方式 + 优惠码 + 场次订票截止校验 + 下单。
import { getCart } from '../api/cart.js';
import { getProfile } from '../api/account.js';
import { createBooking } from '../api/bookings.js';
import { checkPromocode } from '../api/promocodes.js';
import { getConfig } from '../api/config.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };
const alertEl = document.getElementById('purchase-alert');
const ticketsEl = document.getElementById('purchase-tickets');
const confirmBtn = document.getElementById('confirm-btn');
const promoEl = document.getElementById('promo');
const promoMsg = document.getElementById('promo-message');
const promoAppliedEl = document.getElementById('promo-applied');

let cart = null;
let promo = null;   // { code, discountAmount, discountPercent }
let tz = '';

const dateTimeFmt = (iso) => new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
}).format(new Date(iso));

const timeFmt = (iso) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
}).format(new Date(iso));

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 该场次是否已关闭订票：优先用服务端字段，缺字段时用截止时间兜底
function isBookingClosed(session) {
  if (session.isBookingOpen === false) return true;
  if (session.bookingClosesAt && new Date(session.bookingClosesAt) <= new Date()) return true;
  return false;
}

function groupBySession(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.session.id;
    if (!map.has(key)) map.set(key, { session: item.session, seats: [] });
    map.get(key).seats.push(item);
  }
  return [...map.values()].sort((a, b) => new Date(a.session.startsAt) - new Date(b.session.startsAt));
}

function closedGroups() {
  return groupBySession(cart.items).filter((g) => isBookingClosed(g.session));
}

// 票务列表按场次分组：订票关闭的分组加 is-error 并写明截止时间（与购物车页口径一致）
function renderTickets() {
  ticketsEl.innerHTML = groupBySession(cart.items).map((g) => {
    const closed = isBookingClosed(g.session);
    const seats = g.seats.map((s) => `
      <li class="c-cart-seat">
        <span class="c-cart-seat__label">Row ${s.row}, Seat ${s.number}</span>
        <span class="c-badge c-badge--neutral">${s.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
        <span class="c-cart-seat__price">${formatMoney(s.price)}</span>
      </li>`).join('');

    const errorLine = closed
      ? `<p class="c-cart-group__error" role="alert"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg>Booking closed at ${timeFmt(g.session.bookingClosesAt)}</p>`
      : '';

    return `<article class="c-cart-group${closed ? ' is-error' : ''}">
      <header class="c-cart-group__header">
        <div class="c-cart-group__info">
          <div class="c-poster c-poster--xs"><img class="c-poster__img" src="${g.session.posterUrl}" alt=""></div>
          <div>
            <h3 class="c-cart-group__title"><a href="movie.html?id=${g.session.movieId}">${g.session.movieTitle}</a></h3>
            <p class="c-cart-group__meta">${dateTimeFmt(g.session.startsAt)} · ${g.session.hallName}</p>
          </div>
        </div>
        <span class="c-format">${FORMAT[g.session.format]}</span>
      </header>
      ${errorLine}
      <ul class="c-cart-group__seats">${seats}</ul>
      <footer class="c-cart-group__footer"><span>Subtotal</span><span>${formatMoney(g.seats.reduce((sum, s) => sum + s.price, 0))}</span></footer>
    </article>`;
  }).join('');
}

function renderSummary() {
  const subtotal = cart.totalPrice;
  const discount = promo ? (promo.discountAmount ?? Math.round((promo.discountPercent ?? 0) / 100 * subtotal)) : 0;
  const total = Math.max(0, subtotal - discount);

  document.getElementById('purchase-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('purchase-total').textContent = formatMoney(total);

  // 每次都无条件设置 hidden：否则应用过有效码、再输入无效码时，折扣行会残留旧数字
  const discountRow = document.getElementById('purchase-discount-row');
  discountRow.hidden = discount <= 0;
  if (discount > 0) document.getElementById('purchase-discount').textContent = formatMoney(-discount);
}

// 有场次已过订票截止时间：顶部警告 + 禁止下单（需求 13.5）
function renderAlert() {
  const closed = closedGroups();
  confirmBtn.disabled = closed.length > 0;
  if (closed.length === 0) { alertEl.innerHTML = ''; return; }

  const noun = closed.length === 1 ? 'session' : 'sessions';
  const pronoun = closed.length === 1 ? 'its' : 'their';
  alertEl.innerHTML = `<div class="c-alert c-alert--danger" role="alert">
    <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg>
    <div class="c-alert__body"><p>Booking is closed for ${closed.length} ${noun}. Remove ${pronoun} seats from the cart to continue.</p></div>
    <div class="c-alert__action"><a class="c-btn c-btn--secondary c-btn--sm" href="cart.html">Go to cart</a></div>
  </div>`;
}

function renderAppliedPromo() {
  if (!promo) { promoAppliedEl.innerHTML = ''; return; }
  promoAppliedEl.innerHTML = `<p class="c-promo__applied"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-check"></use></svg>Promo code <span class="c-promo__code">${escapeHtml(promo.code)}</span> applied<button class="c-btn c-btn--link c-btn--sm" type="button" id="promo-remove">Remove</button></p>`;

  document.getElementById('promo-remove').addEventListener('click', () => {
    promo = null;
    promoEl.classList.remove('is-success', 'is-error');
    const input = document.getElementById('promo-input');
    input.value = '';
    input.removeAttribute('aria-invalid');
    promoMsg.textContent = '';
    renderAppliedPromo();
    renderSummary();
  });
}

async function init() {
  initHeader();
  const config = await getConfig();
  tz = config.timeZone;

  cart = await getCart();
  if (cart.items.length === 0) { location.href = 'cart.html'; return; }

  const profile = await getProfile();
  document.getElementById('contact-name').textContent = profile.fullName;
  document.getElementById('contact-email').textContent = profile.email;
  document.getElementById('contact-phone').textContent = profile.phoneNumber;

  renderTickets();
  renderSummary();
  renderAlert();
}

// 优惠码：1–32 字符（去首尾空格），校验交给服务端，前端只做长度与状态展示
document.getElementById('promo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('promo-input');
  const code = input.value.trim();
  if (!code) { input.setAttribute('aria-invalid', 'true'); promoMsg.textContent = 'Enter a promo code.'; return; }
  if (code.length > 32) { input.setAttribute('aria-invalid', 'true'); promoMsg.textContent = 'The promo code must be at most 32 characters.'; return; }

  const btn = event.target.querySelector('button[type="submit"]');
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  try {
    const data = await checkPromocode(code);
    promo = { code, discountAmount: data.discountAmount, discountPercent: data.discountPercent };
    promoEl.classList.add('is-success');
    promoEl.classList.remove('is-error');
    input.setAttribute('aria-invalid', 'false');
    promoMsg.textContent = '';
    renderAppliedPromo();
    renderSummary();
  } catch (error) {
    promo = null;
    promoEl.classList.add('is-error');
    promoEl.classList.remove('is-success');
    promoAppliedEl.innerHTML = '';
    input.setAttribute('aria-invalid', 'true');
    promoMsg.textContent = error.detail || 'Invalid promo code.';
    renderSummary();
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
  }
});

// 下单
confirmBtn.addEventListener('click', async () => {
  if (closedGroups().length > 0) { renderAlert(); return; }   // 双保险：按钮理应已禁用

  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  confirmBtn.classList.add('is-loading');
  confirmBtn.setAttribute('aria-busy', 'true');
  try {
    const data = await createBooking({
      cartItemIds: cart.items.map((item) => item.id),   // 只传 id，金额由服务端重算
      paymentMethod,
      promoCode: promo?.code || null,
    });
    location.href = `bookings.html?created=${data.bookings?.length ?? 1}`;
  } catch (error) {
    showToast(error.detail || 'The server is unavailable. Try again later.', 'danger');
    // 座位过期或被抢占：affectedIds 告诉前端哪些条目已失效，回购物车重选
    if (error.affectedIds?.length) location.href = 'cart.html';
  } finally {
    confirmBtn.classList.remove('is-loading');
    confirmBtn.removeAttribute('aria-busy');
  }
});

init().catch(() => { location.href = 'cart.html'; });
