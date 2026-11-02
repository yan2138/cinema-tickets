// session.html — 选座：座位图渲染 + 选座/取消 + 倒计时。
import { getSession, getSessionSeats } from '../api/sessions.js';
import { addCartItem, removeCartItem, getCart } from '../api/cart.js';
import { getConfig } from '../api/config.js';
import { isLoggedIn } from '../api/auth.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const AGE = { Age0: '0+', Age6: '6+', Age12: '12+', Age16: '16+', Age18: '18+' };
const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };

const sessionId = new URLSearchParams(location.search).get('id');
const rowsEl = document.getElementById('seatmap-rows');
let state = { session: null, seats: [], config: null, tz: '' };
let timerId = null;

function timeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: state.tz }).format(new Date(iso));
}

async function load() {
  state.config = await getConfig();
  state.tz = state.config.timeZone;
  state.session = await getSession(sessionId);
  await loadSeats();
}

async function loadSeats() {
  const data = await getSessionSeats(sessionId);
  state.seats = data.seats;
  renderPage();
}

// 页面标题 + 图例 + 座位图 + 摘要
function renderPage() {
  const s = state.session;
  document.getElementById('back-link').href = `movie.html?id=${s.movie.id}`;
  document.getElementById('session-title').textContent = s.movie.title;
  document.getElementById('session-meta').innerHTML = `
    <span class="c-page-title__item"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-calendar"></use></svg>${timeFmt(s.startsAt)}–${timeFmt(s.endsAt)}</span>
    <span class="c-format">${FORMAT[s.format]}</span>
    <span class="c-page-title__item"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-hall"></use></svg>${s.hall.name}</span>
    <span class="c-age">${AGE[s.movie.ageRating]}</span>`;

  document.getElementById('legend').innerHTML = `
    <li class="c-legend__item"><span class="c-seat c-legend__seat" aria-hidden="true"></span>Standard · ${formatMoney(s.prices.standard)}</li>
    <li class="c-legend__item"><span class="c-seat c-seat--vip c-legend__seat" aria-hidden="true"></span>VIP · ${formatMoney(s.prices.vip)}</li>
    <li class="c-legend__item"><span class="c-seat c-legend__seat c-legend__seat--occupied" aria-hidden="true"></span>Occupied</li>
    <li class="c-legend__item"><span class="c-seat c-legend__seat c-legend__seat--mine" aria-hidden="true"></span>In your cart</li>`;

  document.getElementById('seatmap').style.setProperty('--seat-cols', s.hall.seatsPerRow);

  renderRows();
  renderSummary();
}

function seatButton(seat) {
  const vip = seat.type === 'Vip' ? ' c-seat--vip' : '';
  const typeLabel = seat.type === 'Vip' ? 'VIP' : 'Standard';
  if (seat.status === 'Occupied') {
    return `<button class="c-seat${vip}" type="button" disabled aria-label="Row ${seat.row}, Seat ${seat.number}, occupied"></button>`;
  }
  if (seat.status === 'InMyCart') {
    return `<button class="c-seat${vip}" type="button" aria-pressed="true" aria-label="Row ${seat.row}, Seat ${seat.number}, ${typeLabel}, ${formatMoney(seat.price)}" data-row="${seat.row}" data-number="${seat.number}" data-cart-item="${seat.cartItemId}"></button>`;
  }
  return `<button class="c-seat${vip}" type="button" aria-pressed="false" aria-label="Row ${seat.row}, Seat ${seat.number}, ${typeLabel}, ${formatMoney(seat.price)}" data-row="${seat.row}" data-number="${seat.number}"></button>`;
}

function renderRows() {
  const { rowsCount, seatsPerRow } = state.session.hall;
  let html = '';
  for (let r = 1; r <= rowsCount; r++) {
    html += `<div class="c-seatmap__row"><span class="c-seatmap__label" aria-hidden="true">${r}</span>`;
    for (let n = 1; n <= seatsPerRow; n++) {
      const seat = state.seats.find((x) => x.row === r && x.number === n);
      html += seat ? seatButton(seat) : '';
    }
    html += `<span class="c-seatmap__label" aria-hidden="true">${r}</span></div>`;
  }
  rowsEl.innerHTML = html;
}

function renderSummary() {
  const mine = state.seats.filter((s) => s.status === 'InMyCart');
  const list = document.getElementById('summary-list');
  list.innerHTML = mine.map((s) => `
    <li class="c-cart-seat">
      <span class="c-cart-seat__label">Row ${s.row}, Seat ${s.number}</span>
      <span class="c-badge c-badge--neutral">${s.type === 'Vip' ? 'VIP' : 'Standard'}</span>
      <span class="c-cart-seat__price">${formatMoney(s.price)}</span>
      <button class="c-btn c-btn--ghost c-btn--icon c-btn--sm" type="button" aria-label="Remove row ${s.row}, seat ${s.number}" data-cart-item="${s.cartItemId}">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-trash"></use></svg>
      </button>
    </li>`).join('');

  document.getElementById('summary-tickets').textContent = mine.length;
  document.getElementById('summary-total').textContent = formatMoney(mine.reduce((sum, s) => sum + s.price, 0));
  document.getElementById('summary-note').textContent = `Up to ${state.config.maxSeatsPerSession} seats per session. Booking closes at ${timeFmt(state.session.bookingClosesAt)}.`;

  startTimer(mine);
}

// 倒计时：取购物车最早过期时间，每秒刷新
async function startTimer(mine) {
  clearInterval(timerId);
  if (mine.length === 0) { document.getElementById('summary-timer').hidden = true; return; }

  try {
    const cart = await getCart();
    const expiresAt = cart.holdExpiresAt;
    if (!expiresAt) { document.getElementById('summary-timer').hidden = true; return; }
    document.getElementById('summary-timer').hidden = false;

    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      document.getElementById('timer-text').textContent = `Held until ${timeFmt(expiresAt)} · ${mm}:${ss} left`;
      if (left <= 0) { clearInterval(timerId); loadSeats(); }
    };
    tick();
    timerId = setInterval(tick, 1000);
  } catch { /* 忽略 */ }
}

// 选座 / 取消（事件委托）
rowsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.c-seat');
  if (!btn || btn.disabled) return;
  if (!isLoggedIn()) {
    location.href = 'login.html?returnUrl=' + encodeURIComponent(location.pathname + location.search);
    return;
  }
  try {
    if (btn.getAttribute('aria-pressed') === 'true') {
      await removeCartItem(btn.dataset.cartItem);
    } else {
      await addCartItem({ sessionId, row: Number(btn.dataset.row), number: Number(btn.dataset.number) });
    }
    await loadSeats();
  } catch (error) {
    showToast(error.detail || 'Something went wrong. Try again.', 'danger');
    await loadSeats(); // 座位可能被抢占，刷新
  }
});

// 摘要里的删除按钮
document.getElementById('summary-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-cart-item]');
  if (!btn) return;
  try {
    await removeCartItem(btn.dataset.cartItem);
    await loadSeats();
  } catch (error) {
    showToast(error.detail || 'Something went wrong.', 'danger');
    await loadSeats();
  }
});

initHeader();
load().catch(() => {
  document.getElementById('session-title').textContent = 'Session not found';
});
