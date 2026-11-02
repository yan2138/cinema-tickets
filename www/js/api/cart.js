// js/api/cart.js — 购物车接口
import { request } from './apiClient.js';

export function getCart() {
  return request('/api/cart');
}

// 加座位：payload = { sessionId, row, number }
export function addCartItem(payload) {
  return request('/api/cart/items', { method: 'POST', body: payload });
}

// 删除某个座位（cartItemId 来自购物车/座位数据）
export function removeCartItem(id) {
  return request(`/api/cart/items/${id}`, { method: 'DELETE' });
}

// 一键清空购物车
export function clearCart() {
  return request('/api/cart', { method: 'DELETE' });
}
