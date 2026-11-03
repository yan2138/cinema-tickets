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
const seatAlertEl = document.getElementById('seat-alert');
let state = { session: null, seats: [], config: null, tz: '' };
let lock = { closed: false, guest: false };   // 座位是否被整体锁定：订票已关闭 / 游客
let timerId = null;

function timeFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: state.tz }).format(new Date(iso));
}

// 本场是否已关闭订票：优先用服务端字段，缺字段时用截止时间兜底
function isBookingClosed(s) {
  if (s.isBookingOpen === false) return true;
  if (s.bookingClosesAt && new Date(s.bookingClosesAt) <= new Date()) return true;
  return false;
}

async function load() {
  state.config = await getConfig();
  state.tz = state.config.timeZone;
  state.session = await getSession(sessionId);
  await loadSeats();
}

async function loadSeats() {
  const seatmapEl = document.getElementById('seatmap');
  seatmapEl.setAttribute('aria-busy', 'true');
  try {
    const data = await getSessionSeats(sessionId);
    state.seats = data.seats;
    renderPage();
  } finally {
    seatmapEl.removeAttribute('aria-busy');
  }
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

  // 两种整体锁定：本场订票已关闭、未登录（游客不能选座）
  lock = { closed: isBookingClosed(s), guest: !isLoggedIn() };

  renderRows(lock.closed || lock.guest, lock.closed);
  renderSummary();
}

// 座位图上方的提示条：订票关闭 > 游客未登录 > 已达单场上限
function renderSeatAlert(mineCount = 0) {
  if (!seatAlertEl) return;
  const s = state.session;

  if (lock.closed) {
    seatAlertEl.innerHTML = `<div class="c-alert c-alert--warning" role="alert">
      <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-warning"></use></svg>
      <div class="c-alert__body"><p>Booking for this session closed at ${timeFmt(s.bookingClosesAt)}.</p></div>
      <div class="c-alert__action"><a class="c-btn c-btn--secondary c-btn--sm" href="movie.html?id=${s.movie.id}">Back to the movie</a></div>
    </div>`;
    return;
  }

  if (lock.guest) {
    const back = encodeURIComponent(location.pathname + location.search);
    seatAlertEl.innerHTML = `<div class="c-alert c-alert--info" role="status">
      <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-info"></use></svg>
      <div class="c-alert__body"><p>Log in to choose seats for this session.</p></div>
      <div class="c-alert__action"><a class="c-btn c-btn--secondary c-btn--sm" href="login.html?returnUrl=${back}">Log in</a></div>
    </div>`;
    return;
  }

  if (mineCount >= state.config.maxSeatsPerSession) {
    seatAlertEl.innerHTML = `<div class="c-alert c-alert--warning" role="alert">
      <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-warning"></use></svg>
      <div class="c-alert__body"><p>You have selected the maximum of ${state.config.maxSeatsPerSession} seats for this session.</p></div>
    </div>`;
    return;
  }

  seatAlertEl.innerHTML = '';
}

function seatButton(seat, locked, closed) {
  const vip = seat.type === 'Vip' ? ' c-seat--vip' : '';
  const typeLabel = seat.type === 'Vip' ? 'VIP' : 'Standard';
  const closedSuffix = closed ? ', booking closed' : '';
  const pressed = seat.status === 'InMyCart' ? 'true' : 'false';
  const cartAttr = seat.cartItemId ? ` data-cart-item="${seat.cartItemId}"` : '';
  const label = `Row ${seat.row}, Seat ${seat.number}, ${typeLabel}, ${formatMoney(seat.price)}${closedSuffix}`;

  if (seat.status === 'Occupied') {
    return `<button class="c-seat${vip}" type="button" disabled aria-label="Row ${seat.row}, Seat ${seat.number}, occupied"></button>`;
  }
  // 锁定态：保留座位信息与 aria-label，但不给点击能力
  if (locked) {
    return `<button class="c-seat${vip}" type="button" disabled aria-pressed="${pressed}" aria-label="${label}" data-row="${seat.row}" data-number="${seat.number}"${cartAttr}></button>`;
  }
  if (seat.status === 'InMyCart') {
    return `<button class="c-seat${vip}" type="button" aria-pressed="true" aria-label="${label}" data-row="${seat.row}" data-number="${seat.number}"${cartAttr}></button>`;
  }
  return `<button class="c-seat${vip}" type="button" aria-pressed="false" aria-label="${label}" data-row="${seat.row}" data-number="${seat.number}"></button>`;
}

function renderRows(locked, closed) {
  const { rowsCount, seatsPerRow } = state.session.hall;
  // 先建索引，避免在双层循环里对每个座位做一次线性 find
  const bySeat = new Map(state.seats.map((seat) => [`${seat.row}:${seat.number}`, seat]));
  let html = '';
  for (let r = 1; r <= rowsCount; r++) {
    html += `<div class="c-seatmap__row"><span class="c-seatmap__label" aria-hidden="true">${r}</span>`;
    for (let n = 1; n <= seatsPerRow; n++) {
      const seat = bySeat.get(`${r}:${n}`);
      html += seat ? seatButton(seat, locked, closed) : '';
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

  renderSeatAlert(mine.length);
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
  if (lock.closed) return;   // 订票已关闭：不发无意义的请求

  const removing = btn.getAttribute('aria-pressed') === 'true';
  const mineCount = state.seats.filter((s) => s.status === 'InMyCart').length;
  if (!removing && mineCount >= state.config.maxSeatsPerSession) {
    renderSeatAlert(mineCount);
    showToast(`You can select up to ${state.config.maxSeatsPerSession} seats for this session.`, 'danger');
    return;
  }

  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;               // 请求期间禁止连点，避免重复加座
  try {
    if (removing) {
      await removeCartItem(btn.dataset.cartItem);
    } else {
      await addCartItem({ sessionId, row: Number(btn.dataset.row), number: Number(btn.dataset.number) });
    }
    await loadSeats();               // 以服务端返回的座位状态为准
  } catch (error) {
    showToast(error.detail || 'Something went wrong. Try again.', 'danger');
    await loadSeats();               // 座位可能被抢占，刷新
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
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
