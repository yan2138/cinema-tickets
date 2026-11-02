// js/api/movies.js — 电影相关接口
import { request } from './apiClient.js';

// 电影目录：query 里可带 genres / ageRatings / nowShowing / date / sorting / page
export function getMovies(query) {
  return request('/api/movies', { query });
}

export function getMovie(id) {
  return request(`/api/movies/${id}`);
}

// 某电影某天的场次
export function getMovieSessions(id, date) {
  return request(`/api/movies/${id}/sessions`, { query: { date } });
}

// 评论（分页）
export function getReviews(id, query) {
  return request(`/api/movies/${id}/reviews`, { query });
}

// 当前用户能否写评论（NotAttended / Allowed / AlreadyReviewed）
export function getReviewCheck(id) {
  return request(`/api/movies/${id}/reviews/check`);
}

export function createReview(id, payload) {
  return request(`/api/movies/${id}/reviews`, { method: 'POST', body: payload });
}

export function updateReview(movieId, reviewId, payload) {
  return request(`/api/movies/${movieId}/reviews/${reviewId}`, { method: 'PUT', body: payload });
}

export function deleteReview(movieId, reviewId) {
  return request(`/api/movies/${movieId}/reviews/${reviewId}`, { method: 'DELETE' });
}
