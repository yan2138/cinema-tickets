// profile.html — 个人资料：读取渲染 + 保存。
import { getProfile, updateProfile } from '../api/account.js';
import { initPhoneMask } from '../utils/phoneMask.js';
import { showToast } from '../utils/ui.js';
import { initHeader } from '../components/header.js';

const form = document.getElementById('profile-form');

async function init() {
  initHeader();
  const profile = await getProfile();
  document.getElementById('profile-email').textContent = profile.email;
  document.getElementById('profile-gender').textContent = profile.gender;
  form.elements.fullName.value = profile.fullName ?? '';
  form.elements.birthDate.value = profile.birthDate ?? '';
  form.elements.phoneNumber.value = profile.phoneNumber ?? '';
  initPhoneMask(form.elements.phoneNumber);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    fullName: form.elements.fullName.value,
    birthDate: form.elements.birthDate.value,
    phoneNumber: form.elements.phoneNumber.value,
  };
  const btn = form.querySelector('button[type="submit"]');
  btn.classList.add('is-loading');
  try {
    await updateProfile(payload);
    showToast('The profile is saved.', 'success');
  } catch (error) {
    showToast(error.detail || 'The server is unavailable. Try again later.', 'danger');
  } finally {
    btn.classList.remove('is-loading');
  }
});

init().catch(() => {
  location.href = 'login.html';
});
