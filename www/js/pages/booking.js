// booking.html — 订单详情。
import { getBooking, cancelBooking } from '../api/bookings.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const STATUS = { Active: 'c-status--active', Completed: 'c-status--completed', Cancelled: 'c-status--cancelled' };
const root = document.getElementById('booking-root');
const id = new URLSearchParams(location.search).get('id');

function render(b) {
  const tickets = b.tickets.map((t) => `
    <tr>
      <td>Row ${t.row}</td>
      <td>Seat ${t.number}</td>
      <td>${t.seatType === 'Vip' ? 'VIP' : t.seatType}</td>
      <td class="c-table__num">${formatMoney(t.price)}</td>
    </tr>`).join('');

  const cancelBtn = b.status === 'Active'
    ? `<button class="c-btn c-btn--secondary c-btn--danger" type="button" id="cancel-btn">Cancel booking</button>`
    : '';

  root.innerHTML = `
    <a class="c-back-link" href="bookings.html"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-chevron-left"></use></svg>All bookings</a>
    <div class="c-page-title">
      <div class="c-page-title__main">
        <div class="c-page-title__head"><h1>Booking ${b.code}</h1><span class="c-status ${STATUS[b.status]}">${b.status}</span></div>
      </div>
      <div class="c-page-title__actions">${cancelBtn}</div>
    </div>
    <div class="l-split">
      <div class="l-split__main l-stack l-stack--lg">
        <section class="c-card" aria-labelledby="session-title">
          <div class="c-card__body l-media">
            <div class="c-poster c-poster--sm"><img class="c-poster__img" src="${b.movie.posterUrl}" alt=""></div>
            <div class="l-stack">
              <h2 class="c-card__title" id="session-title">${b.movie.title}</h2>
              <p class="u-muted">${new Date(b.session.startsAt).toLocaleString('en-GB')} · ${b.session.hallName} · ${b.session.format === 'TwoD' ? '2D' : b.session.format === 'ThreeD' ? '3D' : 'IMAX'}</p>
            </div>
          </div>
        </section>
        <section class="c-card" aria-labelledby="tickets-title">
          <div class="c-card__header"><h2 class="c-card__title" id="tickets-title">Tickets</h2></div>
          <div class="c-card__body">
            <table class="c-table">
              <thead><tr><th>Row</th><th>Seat</th><th>Type</th><th class="c-table__num">Price</th></tr></thead>
              <tbody>${tickets}</tbody>
            </table>
          </div>
        </section>
      </div>
      <aside class="l-split__aside">
        <section class="c-summary" aria-labelledby="details-title">
          <h2 class="c-summary__title" id="details-title">Details</h2>
          <dl class="c-dl">
            <div class="c-dl__row"><dt class="c-dl__term">Created</dt><dd class="c-dl__desc">${new Date(b.createdAt).toLocaleString('en-GB')}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Payment</dt><dd class="c-dl__desc">${b.paymentMethod}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Contact</dt><dd class="c-dl__desc">${b.contactEmail}<br>${b.contactPhone}</dd></div>
          </dl>
          <dl class="c-summary__lines">
            <div class="c-summary__line"><dt>Subtotal</dt><dd>${formatMoney(b.subtotal)}</dd></div>
            ${b.discountAmount > 0 ? `<div class="c-summary__line c-summary__line--discount"><dt>Discount</dt><dd>${formatMoney(-b.discountAmount)}</dd></div>` : ''}
            <div class="c-summary__total"><dt>Total</dt><dd>${formatMoney(b.total)}</dd></div>
          </dl>
        </section>
      </aside>
    </div>`;

  document.getElementById('cancel-btn')?.addEventListener('click', async () => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await cancelBooking(id);
      showToast('The booking is cancelled.', 'success');
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      showToast(error.detail || 'Something went wrong.', 'danger');
    }
  });
}

initHeader();
getBooking(id).then(render).catch(() => {
  root.innerHTML = `<div class="c-empty c-empty--error"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><h2 class="c-empty__title">Booking not found</h2><p class="c-empty__text">This booking does not exist or you do not have access.</p><a class="c-btn c-btn--primary" href="bookings.html">All bookings</a></div>`;
});
