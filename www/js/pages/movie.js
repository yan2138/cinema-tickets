// movie.html — 电影详情：信息块 + 排片日期标签 + 场次 + 评论（读 + 写 + 编辑 + 删除）。
import {
  getMovie, getMovieSessions, getReviews,
  getReviewCheck, createReview, updateReview, deleteReview,
} from '../api/movies.js';
import { getConfig } from '../api/config.js';
import { isLoggedIn } from '../api/auth.js';
import { formatDuration, formatRating, formatMoney } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const AGE = { Age0: '0+', Age6: '6+', Age12: '12+', Age16: '16+', Age18: '18+' };
const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };

// 评论文本长度限制（需求 5.4：去除首尾空格后 10–1000 字符）
const REVIEW_MIN = 10;
const REVIEW_MAX = 1000;

const id = new URLSearchParams(location.search).get('id');
const detailEl = document.getElementById('movie-detail');
const dateTabsEl = document.getElementById('date-tabs');
const sessionListEl = document.getElementById('session-list');
const reviewFormHost = document.getElementById('review-form');
const myReviewHost = document.getElementById('my-review');
const deleteDialog = document.getElementById('delete-review-dialog');

let reviewTz = '';        // 影院时区：评论日期必须按它显示，而不是本机时区
let myReview = null;      // 当前用户自己的评论（若已写过）
let reviewMode = 'none';  // none | create | edit

function timeFmt(iso, tz) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
}

function reviewDateFmt(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: reviewTz,
  }).format(new Date(iso));
}

function renderDetail(m, tz) {
  const stars = m.reviewsCount > 0
    ? `<div class="c-stars c-stars--lg" style="--rating: ${m.rating}"><span class="c-stars__icons" role="img" aria-label="Rating ${formatRating(m.rating)} out of 10"></span><span class="c-stars__value">${formatRating(m.rating)}</span><span class="c-stars__count">${m.reviewsCount} reviews</span></div>`
    : `<div class="c-stars c-stars--lg"><span class="c-stars__icons" role="img" aria-label="No ratings"></span><span class="c-stars__none">No ratings yet</span></div>`;

  const badges = m.genres.map((g) => `<span class="c-badge c-badge--neutral">${g === 'SciFi' ? 'Sci-Fi' : g}</span>`).join('');
  const release = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(new Date(m.releaseDate));

  detailEl.innerHTML = `
    <div class="c-poster c-poster--lg"><img class="c-poster__img" src="${m.posterUrl}" alt=""></div>
    <div class="l-stack">
      <h1 id="movie-title">${m.title}</h1>
      <div class="l-cluster"><span class="c-age">${AGE[m.ageRating]}</span>${badges}</div>
      ${stars}
      <p>${m.description}</p>
      <dl class="c-dl">
        <div class="c-dl__row"><dt class="c-dl__term">Director</dt><dd class="c-dl__desc">${m.director}</dd></div>
        <div class="c-dl__row"><dt class="c-dl__term">Cast</dt><dd class="c-dl__desc">${m.cast.join(', ')}</dd></div>
        <div class="c-dl__row"><dt class="c-dl__term">Country</dt><dd class="c-dl__desc">${m.country}</dd></div>
        <div class="c-dl__row"><dt class="c-dl__term">Duration</dt><dd class="c-dl__desc">${formatDuration(m.durationMinutes)}</dd></div>
        <div class="c-dl__row"><dt class="c-dl__term">Release date</dt><dd class="c-dl__desc">${release}</dd></div>
      </dl>
    </div>`;
}

// 日期标签：未来 scheduleDaysAhead 天；无场次的日期禁用
function renderDateTabs(m, config, selectedDate) {
  const tz = config.timeZone;
  const toDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: tz });
  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: tz });

  const tabs = [];
  for (let i = 0; i <= config.scheduleDaysAhead; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const dateStr = toDate(d);
    const hasSessions = m.sessionDates.includes(dateStr);
    const day = i === 0 ? 'Today' : dayFmt.format(d);
    const isCurrent = dateStr === selectedDate;
    if (hasSessions) {
      tabs.push(`<a class="c-date-tabs__tab" href="movie.html?id=${id}&date=${dateStr}" ${isCurrent ? 'aria-current="date"' : ''}><span class="c-date-tabs__day">${day}</span><span class="c-date-tabs__date">${dateFmt.format(d)}</span></a>`);
    } else {
      tabs.push(`<a class="c-date-tabs__tab" aria-disabled="true"><span class="c-date-tabs__day">${day}</span><span class="c-date-tabs__date">${dateFmt.format(d)}</span></a>`);
    }
  }
  dateTabsEl.innerHTML = tabs.join('');
}

// 场次按格式分组（IMAX → 3D → 2D）
function renderSessions(sessions, tz) {
  const order = ['Imax', 'ThreeD', 'TwoD'];
  const groups = {};
  for (const s of sessions) (groups[s.format] ||= []).push(s);

  const html = order.filter((f) => groups[f]).map((f) => {
    const list = groups[f];
    const halls = [...new Set(list.map((s) => s.hall.name))].join(', ');
    const items = list.map((s) => {
      if (!s.isBookingOpen) {
        return `<a class="c-session" aria-disabled="true"><span class="c-session__time">${timeFmt(s.startsAt, tz)}</span><span class="c-session__hall">${s.hall.name}</span><span class="c-session__price">Booking closed</span></a>`;
      }
      return `<a class="c-session" href="session.html?id=${s.id}"><span class="c-session__time">${timeFmt(s.startsAt, tz)}</span><span class="c-session__hall">${s.hall.name}</span><span class="c-session__price">from ${formatMoney(s.prices.standard)}</span></a>`;
    }).join('');
    return `<section class="c-session-group"><header class="c-session-group__header"><span class="c-format">${FORMAT[f]}</span><span class="c-session-group__halls">${halls}</span></header><div class="c-session-group__list">${items}</div></section>`;
  }).join('');

  sessionListEl.innerHTML = html || `<div class="c-empty"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-calendar"></use></svg><h2 class="c-empty__title">No sessions</h2><p class="c-empty__text">No sessions on this date.</p></div>`;
}

// ---------- 评论列表 ----------
let reviewsPage = 1;

async function loadReviews(reset = true) {
  if (reset) reviewsPage = 1;
  const data = await getReviews(id, { page: reviewsPage });
  document.getElementById('reviews-count').textContent = data.pagination.totalItems;

  // 自己的评论不混在公共列表里：记下来单独渲染在上方，并从列表剔除
  const mine = data.reviews.find((r) => r.isMine);
  if (mine && !myReview) myReview = mine;
  const others = data.reviews.filter((r) => !r.isMine);

  const listEl = document.getElementById('reviews-list');
  const items = others.map((r) => `
    <article class="c-review">
      <header class="c-review__header">
        <span class="c-review__author">${r.authorName}</span>
        <div class="c-stars c-stars--sm" style="--rating: ${r.rating}"><span class="c-stars__icons" role="img" aria-label="Rating ${formatRating(r.rating)} out of 10"></span><span class="c-stars__value">${formatRating(r.rating)}</span></div>
        <time class="c-review__date" datetime="${r.createdAt}">${reviewDateFmt(r.createdAt)}</time>
      </header>
      <p class="c-review__text">${r.text}</p>
    </article>`).join('');

  listEl.innerHTML = reset ? items : listEl.innerHTML + items;

  const moreEl = document.getElementById('reviews-more');
  if (reviewsPage < data.pagination.pageCount) {
    moreEl.innerHTML = `<button class="c-btn c-btn--secondary" type="button" id="show-more">Show more reviews</button>`;
    document.getElementById('show-more').addEventListener('click', async () => {
      reviewsPage++;
      await loadReviews(false);
    });
  } else {
    moreEl.innerHTML = '';
  }
}

// ---------- 评论写入区（check → 表单 / 自己的评论 / 提示） ----------

function starsInputHtml(current) {
  const radios = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<label class="c-stars-input__star"><input class="c-stars-input__radio" type="radio" name="rating" value="${n}"${current === n ? ' checked' : ''}><span class="u-visually-hidden">${n} of 10</span></label>`).join('');
  return `<fieldset class="c-stars-input">
      <legend class="c-stars-input__legend">Your rating</legend>
      <div class="c-stars-input__row">
        <div class="c-stars-input__stars">${radios}</div>
        <output class="c-stars-input__value">${current ? `${current} / 10` : '— / 10'}</output>
      </div>
    </fieldset>`;
}

// 用户输入要回填进 <textarea>，先转义，避免把 `</textarea>` 当成标签
function escapeText(value) {
  return String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function reviewFormHtml(mode, review) {
  const isEdit = mode === 'edit';
  const text = review?.text ?? '';
  return `<form class="c-review-form" id="review-form-el" aria-labelledby="review-form-title" novalidate>
      <h3 class="c-review-form__title" id="review-form-title">Your review</h3>
      ${starsInputHtml(review?.rating ?? 0)}
      <div class="c-field">
        <label class="c-field__label" for="review-text">Review text</label>
        <textarea class="c-textarea" id="review-text" name="text" rows="5" maxlength="${REVIEW_MAX}">${escapeText(text)}</textarea>
        <div class="c-review-form__meta"><span class="c-review-form__counter">${text.trim().length} / ${REVIEW_MAX}</span></div>
      </div>
      <div class="c-review-form__actions">
        <button class="c-btn c-btn--primary" type="submit">${isEdit ? 'Save' : 'Publish review'}</button>
        ${isEdit ? '<button class="c-btn c-btn--ghost" type="button" id="review-cancel">Cancel</button>' : ''}
      </div>
    </form>`;
}

function myReviewCard(r) {
  return `<article class="c-review c-review--mine">
      <header class="c-review__header">
        <span class="c-badge c-badge--accent">Your review</span>
        <div class="c-stars c-stars--sm" style="--rating: ${r.rating}"><span class="c-stars__icons" role="img" aria-label="Rating ${formatRating(r.rating)} out of 10"></span><span class="c-stars__value">${formatRating(r.rating)}</span></div>
        <time class="c-review__date" datetime="${r.createdAt}">${reviewDateFmt(r.createdAt)}</time>
        <div class="c-review__actions">
          <button class="c-btn c-btn--ghost c-btn--sm" type="button" data-review-action="edit"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-edit"></use></svg>Edit</button>
          <button class="c-btn c-btn--ghost c-btn--danger c-btn--sm" type="button" data-review-action="delete"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-trash"></use></svg>Delete</button>
        </div>
      </header>
      <p class="c-review__text">${r.text}</p>
    </article>`;
}

function clearReviewError(form) {
  form.querySelectorAll('input[name="rating"]').forEach((radio) => radio.removeAttribute('aria-invalid'));
  const textarea = form.querySelector('#review-text');
  textarea?.removeAttribute('aria-invalid');
  textarea?.removeAttribute('aria-describedby');
  form.querySelector('.c-review-form__meta .c-field__error')?.remove();
}

// 错误提示放在 c-review-form__meta 里（与 kit 的编辑态一致），并给对应控件加 aria-invalid
function showReviewError(form, message, field) {
  const meta = form.querySelector('.c-review-form__meta');
  let errorEl = meta.querySelector('.c-field__error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'c-field__error';
    errorEl.id = 'review-error';
    errorEl.innerHTML = `<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><span></span>`;
    meta.prepend(errorEl);
  }
  errorEl.querySelector('span').textContent = message;

  if (field === 'rating') {
    form.querySelectorAll('input[name="rating"]').forEach((radio) => radio.setAttribute('aria-invalid', 'true'));
  } else {
    const textarea = form.querySelector('#review-text');
    textarea.setAttribute('aria-invalid', 'true');
    textarea.setAttribute('aria-describedby', 'review-error');
  }
}

function bindReviewForm() {
  const form = document.getElementById('review-form-el');
  if (!form) return;

  const counter = form.querySelector('.c-review-form__counter');
  const ratingValue = form.querySelector('.c-stars-input__value');
  const textarea = form.querySelector('#review-text');

  form.addEventListener('change', (event) => {
    if (event.target.name === 'rating') ratingValue.textContent = `${event.target.value} / 10`;
  });

  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.trim().length} / ${REVIEW_MAX}`;
  });

  document.getElementById('review-cancel')?.addEventListener('click', () => { initReviewArea(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearReviewError(form);

    const rating = Number(form.elements.rating.value || 0);
    const text = textarea.value.trim();

    if (!rating) { showReviewError(form, 'Choose a rating from 1 to 10.', 'rating'); return; }
    if (text.length < REVIEW_MIN || text.length > REVIEW_MAX) {
      showReviewError(form, `The review text must be ${REVIEW_MIN} to ${REVIEW_MAX} characters long.`, 'text');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    try {
      if (reviewMode === 'edit' && myReview) {
        await updateReview(id, myReview.id, { rating, text });
      } else {
        await createReview(id, { rating, text });
      }
      myReview = null;
      await loadReviews(true);       // 重新取第一页：自己的评论会被重新识别并提到上方
      await initReviewArea();
      showToast(reviewMode === 'edit' ? 'The review is saved.' : 'The review is published.', 'success');
    } catch (error) {
      showToast(error.detail || 'The server is unavailable. Try again later.', 'danger');
    } finally {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
    }
  });
}

function renderMyReview() {
  reviewMode = 'none';
  reviewFormHost.innerHTML = '';
  myReviewHost.innerHTML = myReviewCard(myReview);

  myReviewHost.querySelector('[data-review-action="edit"]').addEventListener('click', () => {
    reviewMode = 'edit';
    myReviewHost.innerHTML = '';
    reviewFormHost.innerHTML = reviewFormHtml('edit', myReview);
    bindReviewForm();
  });

  myReviewHost.querySelector('[data-review-action="delete"]').addEventListener('click', () => {
    deleteDialog.showModal();
  });
}

async function initReviewArea() {
  reviewFormHost.innerHTML = '';
  myReviewHost.innerHTML = '';

  const infoAlert = (html) => `<div class="c-alert c-alert--info" role="status"><svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-info"></use></svg><div class="c-alert__body">${html}</div></div>`;

  if (!isLoggedIn()) {
    const back = encodeURIComponent(location.pathname + location.search);
    reviewFormHost.innerHTML = infoAlert(`<p><a href="login.html?returnUrl=${back}">Log in</a> to write a review.</p>`);
    return;
  }

  let status = '';
  try {
    const check = await getReviewCheck(id);
    status = typeof check === 'string' ? check : (check?.status ?? '');
    if (check?.review) myReview = check.review;
  } catch {
    return;   // 401 / 网络异常：评论可读即可，不阻塞页面
  }

  if (status === 'NotAttended') {
    reviewFormHost.innerHTML = infoAlert('<p>You can review this movie after attending one of its sessions.</p>');
    return;
  }

  if (status === 'AlreadyReviewed') {
    if (myReview) { renderMyReview(); return; }
    // check 没带评论正文，且列表里也没找到（例如在后面的分页）——不给重复发布的表单
    reviewFormHost.innerHTML = infoAlert('<p>You have already reviewed this movie.</p>');
    return;
  }

  reviewMode = 'create';
  reviewFormHost.innerHTML = reviewFormHtml('create', null);
  bindReviewForm();
}

// 删除确认弹窗：只在点「Delete」时才发请求
deleteDialog.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-dialog]')?.dataset.dialog;
  if (!action) return;
  if (action === 'cancel') { deleteDialog.close(); return; }

  deleteDialog.close();
  if (!myReview) return;
  try {
    await deleteReview(id, myReview.id);
    myReview = null;
    await loadReviews(true);
    await initReviewArea();
    showToast('The review is deleted.', 'success');
  } catch (error) {
    showToast(error.detail || 'Something went wrong. Try again.', 'danger');
  }
});

async function init() {
  initHeader();
  const config = await getConfig();
  reviewTz = config.timeZone;
  const selectedDate = new URLSearchParams(location.search).get('date');

  const movie = await getMovie(id);
  renderDetail(movie, config.timeZone);

  if (movie.isNowShowing || movie.sessionDates.length > 0) {
    renderDateTabs(movie, config, selectedDate || movie.sessionDates[0]);
    const date = selectedDate || movie.sessionDates[0];
    const sessions = await getMovieSessions(id, date);
    renderSessions(sessions, config.timeZone);
  } else {
    const release = reviewDateFmt(movie.releaseDate);
    sessionListEl.innerHTML = `<div class="c-alert c-alert--info"><svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-info"></use></svg><div class="c-alert__body"><p>Sessions will be available from ${release}.</p></div></div>`;
  }

  await loadReviews();       // 先取列表：顺带识别自己的评论
  await initReviewArea();
}

init().catch(() => {
  detailEl.innerHTML = `<div class="c-empty c-empty--error"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><h2 class="c-empty__title">Movie not found</h2><p class="c-empty__text">This movie does not exist.</p><a class="c-btn c-btn--primary" href="index.html">All movies</a></div>`;
});
