// js/api/sessions.js — 场次、座位接口
import { request } from './apiClient.js';

export function getSession(id) {
  return request(`/api/sessions/${id}`);
}

export function getSessionSeats(id) {
  return request(`/api/sessions/${id}/seats`);
}
