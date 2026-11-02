// purchase.html — 结算：联系人 + 支付方式 + 优惠码 + 下单。
import { getCart } from '../api/cart.js';
import { getProfile } from '../api/account.js';
import { createBooking } from '../api/bookings.js';
import { checkPromocode } from '../api/promocodes.js';
import { formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

let cart = null;
let promo = null; // { code, discountAmount, discountPercent }

function renderSummary() {
  const list = document.getElementById('purchase-list');
  list.innerHTML = cart.items.map((i) => `
    <li class="c-cart-seat">
      <span class="c-cart-seat__label">${i.session.movieTitle} — Row ${i.row}, Seat ${i.number}</span>
      <span class="c-cart-seat__price">${formatMoney(i.price)}</span>
    </li>`).join('');

  const subtotal = cart.totalPrice;
  const discount = promo?.discountAmount ?? Math.round((promo?.discountPercent ?? 0) / 100 * subtotal);
  const total = subtotal - discount;

  document.getElementById('purchase-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('purchase-total').textContent = formatMoney(total);
  if (discount > 0) {
    document.getElementById('purchase-discount-row').hidden = false;
    document.getElementById('purchase-discount').textContent = formatMoney(-discount);
  }
}

async function init() {
  initHeader();
  cart = await getCart();
  if (cart.items.length === 0) { location.href = 'cart.html'; return; }

  const profile = await getProfile();
  document.getElementById('contact-name').textContent = profile.fullName;
  document.getElementById('contact-email').textContent = profile.email;
  document.getElementById('contact-phone').textContent = profile.phoneNumber;

  renderSummary();
}

// 优惠码
document.getElementById('promo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = document.getElementById('promo-input').value.trim();
  const msg = document.getElementById('promo-message');
  if (!code) return;

  try {
    const data = await checkPromocode(code);
    promo = { code, discountAmount: data.discountAmount, discountPercent: data.discountPercent };
    msg.textContent = `Promo code applied.`;
    document.getElementById('promo-input').setAttribute('aria-invalid', 'false');
    renderSummary();
  } catch (error) {
    promo = null;
    msg.textContent = error.detail || 'Invalid promo code.';
    document.getElementById('promo-input').setAttribute('aria-invalid', 'true');
    renderSummary();
  }
});

// 下单
document.getElementById('confirm-btn').addEventListener('click', async () => {
  const btn = document.getElementById('confirm-btn');
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  try {
    const data = await createBooking({
      cartItemIds: cart.items.map((i) => i.id),
      paymentMethod,
      promoCode: promo?.code || null,
    });
    location.href = `bookings.html?created=${data.bookings?.length ?? 1}`;
  } catch (error) {
    showToast(error.detail || 'The server is unavailable. Try again later.', 'danger');
    // 座位可能过期/被抢占，回到购物车刷新
    if (error.affectedIds?.length) location.href = 'cart.html';
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
  }
});

init().catch(() => { location.href = 'cart.html'; });
