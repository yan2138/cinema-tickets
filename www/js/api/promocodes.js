// js/api/promocodes.js — 优惠码接口
import { request } from './apiClient.js';

export function checkPromocode(code) {
  return request('/api/promocodes/check', { method: 'POST', body: { code } });
}
