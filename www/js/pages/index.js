// index.html — 电影目录：读取 URL 参数 → 请求 → 渲染卡片 + 分页。
import { getMovies } from '../api/movies.js';
import { getConfig } from '../api/config.js';
import { formatDuration, formatRating } from '../utils/format.js';
import { initHeader } from '../components/header.js';

const grid = document.querySelector('.l-grid');
const subtitle = document.querySelector('.c-page-title__subtitle');
const pagination = document.querySelector('.c-pagination');

// 从地址栏读筛选参数
function readParams() {
  const p = new URLSearchParams(location.search);
  return {
    genres: p.getAll('genres'),
    ageRatings: p.getAll('ageRatings'),
    nowShowing: p.get('nowShowing') === 'true',
    date: p.get('date') || '',
    sorting: p.get('sorting') || '',
    page: Number(p.get('page')) || 1,
  };
}

// 把参数回填到筛选控件（刷新页面后状态恢复）
function fillFilters(params) {
  for (const name of ['genres', 'ageRatings']) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((cb) => {
      cb.checked = params[name].includes(cb.value);
    });
  }
  document.querySelector('select[name="date"]').value = params.date;
  document.querySelector('select[name="sorting"]').value = params.sorting;
  document.querySelector('input[name="nowShowing"]').checked = params.nowShowing;
}

// 生成"日期"下拉选项：今天起 scheduleDaysAhead 天
function fillDateOptions(config) {
  const select = document.querySelector('select[name="date"]');
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: config.timeZone });
  const toDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  for (let i = 0; i <= config.scheduleDaysAhead; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const opt = document.createElement('option');
    opt.value = toDate(d);
    opt.textContent = i === 0 ? `Today, ${fmt.format(d)}` : fmt.format(d);
    select.appendChild(opt);
  }
}

// 一张电影卡片
function movieCard(m) {
  const stars = m.reviewsCount > 0
    ? `<div class="c-stars c-stars--sm" style="--rating: ${m.rating}"><span class="c-stars__icons" role="img" aria-label="Rating ${formatRating(m.rating)} out of 10"></span><span class="c-stars__value">${formatRating(m.rating)}</span><span class="c-stars__count">${m.reviewsCount} reviews</span></div>`
    : `<div class="c-stars c-stars--sm"><span class="c-stars__icons" role="img" aria-label="No ratings"></span><span class="c-stars__none">No ratings yet</span></div>`;

  const badge = m.isNowShowing ? '' : `<span class="c-badge c-badge--neutral">Coming soon</span>`;
  const genres = m.genres.map((g) => (g === 'SciFi' ? 'Sci-Fi' : g)).join(', ');

  return `<article class="c-movie-card">
    <div class="c-movie-card__media">
      <div class="c-poster c-poster--md"><img class="c-poster__img" src="${m.posterUrl}" alt=""></div>
      ${badge}
    </div>
    <h2 class="c-movie-card__title"><a class="c-movie-card__link" href="movie.html?id=${m.id}">${m.title}</a></h2>
    <p class="c-movie-card__meta">${genres} · ${formatDuration(m.durationMinutes)}</p>
    ${stars}
  </article>`;
}

// 骨架屏（加载中显示 8 个占位）
function renderSkeleton() {
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <article class="c-movie-card">
      <div class="c-movie-card__media"><div class="c-skeleton c-skeleton--poster"></div></div>
      <div class="c-skeleton c-skeleton--title"></div>
      <div class="c-skeleton c-skeleton--text"></div>
    </article>`).join('');
}

// 分页：全部用 <a href>，保留现有筛选参数，只改 page
function renderPagination(p) {
  const params = new URLSearchParams(location.search);
  const link = (page) => {
    params.set('page', page);
    return `index.html?${params.toString()}`;
  };
  const cur = p.currentPage;
  const parts = [];
  if (cur > 1) {
    parts.push(`<a class="c-pagination__link" href="${link(cur - 1)}"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-chevron-left"></use></svg>Previous</a>`);
  } else {
    parts.push(`<a class="c-pagination__link" aria-disabled="true"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-chevron-left"></use></svg>Previous</a>`);
  }
  for (let i = 1; i <= p.pageCount; i++) {
    parts.push(`<a class="c-pagination__link" href="${link(i)}" ${i === cur ? 'aria-current="page"' : ''}>${i}</a>`);
  }
  if (cur < p.pageCount) {
    parts.push(`<a class="c-pagination__link" href="${link(cur + 1)}">Next<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-chevron-right"></use></svg></a>`);
  } else {
    parts.push(`<a class="c-pagination__link" aria-disabled="true">Next<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="../kit/icons.svg#icon-chevron-right"></use></svg></a>`);
  }
  pagination.innerHTML = parts.join('');
}

async function load() {
  const params = readParams();
  renderSkeleton();

  try {
    const config = await getConfig();
    fillDateOptions(config);
    fillFilters(params);
    const data = await getMovies({
      genres: params.genres,
      ageRatings: params.ageRatings,
      nowShowing: params.nowShowing || undefined,
      date: params.date || undefined,
      sorting: params.sorting || undefined,
      page: params.page,
    });

    subtitle.textContent = `${data.pagination.totalItems} movies`;

    if (data.movies.length === 0) {
      grid.innerHTML = `<div class="c-empty" style="grid-column: 1 / -1;">
        <svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-search"></use></svg>
        <h2 class="c-empty__title">No movies found</h2>
        <p class="c-empty__text">Try adjusting the filters.</p>
        <a class="c-btn c-btn--primary" href="index.html">Reset filters</a>
      </div>`;
      pagination.innerHTML = '';
    } else {
      grid.innerHTML = data.movies.map(movieCard).join('');
      renderPagination(data.pagination);
    }
  } catch (error) {
    grid.innerHTML = `<div class="c-empty c-empty--error" style="grid-column: 1 / -1;">
      <svg class="c-icon c-empty__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg>
      <h2 class="c-empty__title">Something went wrong</h2>
      <p class="c-empty__text">The server is unavailable. Try again later.</p>
    </div>`;
  }
}

initHeader();
load();
