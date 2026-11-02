// js/api/config.js
// 拉取并缓存 GET /api/config。全站的时区、锁定时长、分页大小都从这里读，
// 禁止把这些数字硬编码进页面代码。

import { request } from './apiClient.js';

let cache = null;

export async function getConfig() {
  if (!cache) {
    cache = await request('/api/config');
  }
  return cache;
}
