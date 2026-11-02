// registration.html — 注册：前端校验 + 提交。
import { register } from '../api/account.js';
import { initPhoneMask } from '../utils/phoneMask.js';
import { initHeader } from '../components/header.js';

const form = document.getElementById('reg-form');

initPhoneMask(document.getElementById('reg-phone'));

// 校验：返回 { 字段名: 错误文案 } 或空对象
function validate(values) {
  const errors = {};
  if (!values.fullName.trim()) errors.fullName = 'The full name is required.';
  else if (values.fullName.trim().length > 100) errors.fullName = 'The full name must be at most 100 characters.';

  if (!values.email.trim()) errors.email = 'The email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Enter a valid email address.';

  if (!values.password) errors.password = 'The password is required.';
  else if (values.password.length < 6 || values.password.length > 64) errors.password = 'The password must be 6 to 64 characters long.';
  else if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) errors.password = 'The password must contain at least one letter and one digit.';

  if (!values.birthDate) errors.birthDate = 'The date of birth is required.';

  const phone = values.phoneNumber.replace(/\D/g, '');
  if (phone.length !== 11) errors.phoneNumber = 'The phone number must match the format +7 (xxx) xxx-xx-xx.';

  return errors;
}

// 把错误展示到对应字段下方
function showFieldErrors(errors) {
  form.querySelectorAll('.c-field').forEach((field) => {
    const input = field.querySelector('input');
    if (!input) return;
    const name = input.name;
    const err = errors[name];
    field.querySelector('.c-field__error')?.remove();
    if (err) {
      const p = document.createElement('p');
      p.className = 'c-field__error';
      p.textContent = err;
      field.appendChild(p);
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  });
}

function showTopError(message) {
  let alert = form.querySelector('.c-alert');
  if (!alert) {
    alert = document.createElement('div');
    alert.className = 'c-alert c-alert--danger';
    alert.setAttribute('role', 'alert');
    form.prepend(alert);
  }
  alert.innerHTML = `<svg class="c-icon c-alert__icon" aria-hidden="true"><use href="../kit/icons.svg#icon-error"></use></svg><div class="c-alert__body"><p>${message}</p></div>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = {
    fullName: form.elements.fullName.value,
    email: form.elements.email.value,
    password: form.elements.password.value,
    birthDate: form.elements.birthDate.value,
    gender: form.elements.gender.value,
    phoneNumber: form.elements.phoneNumber.value,
  };

  const errors = validate(values);
  showFieldErrors(errors);
  if (Object.keys(errors).length > 0) return;

  const btn = form.querySelector('button[type="submit"]');
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  try {
    await register(values);
    location.href = 'index.html';
  } catch (error) {
    if (error.code === 'EMAIL_TAKEN') {
      showTopError(error.detail || 'This email is already registered.');
      form.elements.email.setAttribute('aria-invalid', 'true');
    } else if (error.code === 'VALIDATION_ERROR') {
      showFieldErrors(Object.fromEntries(Object.entries(error.errors || {}).map(([k, v]) => [k, v[0]])));
    } else {
      showTopError(error.detail || 'The server is unavailable. Try again later.');
    }
  } finally {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
  }
});

initHeader();
