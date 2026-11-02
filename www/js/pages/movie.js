// movie.html — 电影详情：信息块 + 排片日期标签 + 场次 + 评论。
import { getMovie, getMovieSessions, getReviews } from '../api/movies.js';
import { getConfig } from '../api/config.js';
import { isLoggedIn } from '../api/auth.js';
import { formatDuration, formatRating } from '../utils/format.js';
import { initHeader } from '../components/header.js';

const AGE = { Age0: '0+', Age6: '6+', Age12: '12+', Age16: '16+', Age18: '18+' };
const FORMAT = { Imax: 'IMAX', ThreeD: '3D', TwoD: '2D' };

const id = new URLSearchParams(location.search).get('id');
const detailEl = document.getElementById('movie-detail');
const dateTabsEl = document.getElementById('date-tabs');
const sessionListEl = document.getElementById('session-list');

function timeFmt(iso, tz) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
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
      return `<a class="c-session" href="session.html?id=${s.id}"><span class="c-session__time">${timeFmt(s.startsAt, tz)}</span><span class="c-session__hall">${s.hall.name}</span><span class="c-session__price">from ${s.prices.standard} ₽</span></a>`;
    }).join('');
    return `<section class="c-session-group"><header class="c-session-group__header"><span class="c-format">${FORMAT[f]}</span><span class="c-session-group__halls">${halls}</span></header><div class="c-session-group__list">${items}</div></section>`;
  }).join('');

  sessionListEl.innerHTML = html || `<div class="c-empty"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-calendar"></use></svg><h2 class="c-empty__title">No sessions</h2><p class="c-empty__text">No sessions on this date.</p></div>`;
}

// 评论列表
let reviewsPage = 1;
async function loadReviews(reset = true) {
  if (reset) reviewsPage = 1;
  const data = await getReviews(id, { page: reviewsPage });
  document.getElementById('reviews-count').textContent = data.pagination.totalItems;

  const listEl = document.getElementById('reviews-list');
  const items = data.reviews.map((r) => `
    <article class="c-review${r.isMine ? ' c-review--mine' : ''}">
      <header class="c-review__header">
        <span class="c-review__author">${r.authorName}</span>
        <div class="c-stars c-stars--sm" style="--rating: ${r.rating}"><span class="c-stars__icons" role="img" aria-label="Rating ${r.rating} out of 10"></span></div>
        <time class="c-review__date" datetime="${r.createdAt}">${new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
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

async function init() {
  initHeader();
  const config = await getConfig();
  const selectedDate = new URLSearchParams(location.search).get('date');

  const movie = await getMovie(id);
  renderDetail(movie, config.timeZone);

  if (movie.isNowShowing || movie.sessionDates.length > 0) {
    renderDateTabs(movie, config, selectedDate || movie.sessionDates[0]);
    const date = selectedDate || movie.sessionDates[0];
    const sessions = await getMovieSessions(id, date);
    renderSessions(sessions, config.timeZone);
  } else {
    sessionListEl.innerHTML = `<div class="c-alert c-alert--info"><svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-info"></use></svg><div class="c-alert__body"><p>Sessions will be available from ${movie.releaseDate}.</p></div></div>`;
  }

  if (isLoggedIn()) {
    // 登录用户显示"写评论"区（简化：仅提示去评分）
    document.getElementById('review-form').innerHTML = '';
  }
  await loadReviews();
}

init().catch(() => {
  detailEl.innerHTML = `<div class="c-empty c-empty--error"><svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><h2 class="c-empty__title">Movie not found</h2><p class="c-empty__text">This movie does not exist.</p><a class="c-btn c-btn--primary" href="index.html">All movies</a></div>`;
});
