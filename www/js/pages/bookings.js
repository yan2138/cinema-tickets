// bookings.html — 订单列表：状态相关的操作按钮。
import { getBookings, cancelBooking } from '../api/bookings.js';
import { getCart } from '../api/cart.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const STATUS = { Active: 'c-status--active', Completed: 'c-status--completed', Cancelled: 'c-status--cancelled' };
const listEl = document.getElementById('bookings-list');

function bookingCard(b) {
  const status = `<span class="c-status ${STATUS[b.status]}">${b.status}</span>`;
  let action = '';
  if (b.status === 'Active') {
    action = `<button class="c-btn c-btn--secondary c-btn--danger" type="button" data-cancel="${b.id}">Cancel booking</button>`;
  } else if (b.status === 'Completed') {
    action = `<a class="c-btn c-btn--secondary" href="movie.html?id=${b.movie.id}">Review the movie</a>`;
  }

  return `<article class="c-booking-item">
    <div class="c-booking-item__main">
      <div class="c-poster c-poster--xs"><img class="c-poster__img" src="${b.movie.posterUrl}" alt=""></div>
      <div>
        <h2 class="c-booking-item__title"><a href="booking.html?id=${b.id}">${b.movie.title}</a></h2>
        <p class="c-booking-item__meta">${b.code} · ${new Date(b.session.startsAt).toLocaleString('en-GB')} · ${b.session.hallName}</p>
      </div>
    </div>
    <span class="c-booking-item__tickets">${b.ticketsCount} ticket${b.ticketsCount > 1 ? 's' : ''}</span>
    <span class="c-booking-item__total">${formatMoney(b.total)}</span>
    <div class="c-booking-item__actions">${status}${action}</div>
  </article>`;
}

async function load() {
  initHeader();
  // 购物车不为空时顶部提示
  try {
    const cart = await getCart();
    if (cart.ticketsCount > 0) {
      listEl.insertAdjacentHTML('beforebegin', `<div class="c-alert c-alert--info"><svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-cart"></use></svg><div class="c-alert__body"><p>You have ${cart.ticketsCount} tickets in the cart. <a href="cart.html">Go to checkout</a></p></div></div>`);
    }
  } catch { /* 忽略 */ }

  const bookings = await getBookings();
  if (bookings.length === 0) {
    listEl.innerHTML = `<div class="c-empty"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-ticket"></use></svg><h2 class="c-empty__title">No bookings yet</h2><p class="c-empty__text">When you book tickets, they will appear here.</p><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>`;
    return;
  }
  listEl.innerHTML = bookings.map(bookingCard).join('');
}

// 取消订单
listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-cancel]');
  if (!btn) return;
  if (!confirm('Cancel this booking?')) return;
  try {
    await cancelBooking(btn.dataset.cancel);
    showToast('The booking is cancelled.', 'success');
    await load();
  } catch (error) {
    showToast(error.detail || 'Something went wrong.', 'danger');
  }
});

// 刚下单提示
const created = new URLSearchParams(location.search).get('created');
if (created) {
  showToast(`${created} booking${created > 1 ? 's' : ''} created. The cart is empty.`, 'success');
}

load().catch(() => { location.href = 'login.html'; });
