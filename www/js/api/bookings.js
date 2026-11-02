// js/api/bookings.js — 订单接口
import { request } from './apiClient.js';

export function getBookings() {
  return request('/api/bookings');
}

export function getBooking(id) {
  return request(`/api/bookings/${id}`);
}

// 下单：payload = { cartItemIds, paymentMethod, promoCode }
export function createBooking(payload) {
  return request('/api/bookings', { method: 'POST', body: payload });
}

// 取消订单
export function cancelBooking(id) {
  return request(`/api/bookings/${id}/cancel`, { method: 'POST' });
}
