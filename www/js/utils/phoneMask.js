// js/utils/phoneMask.js — 手机号掩码输入 +7 (xxx) xxx-xx-xx。
// 只收数字，自动填分隔符；粘贴 8xxx / +79xxx 也会规整成掩码格式。

export function initPhoneMask(input) {
  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '');
    // 去掉俄罗斯手机号常见的前导 8 或 7（含 +7 的 7）
    if (digits.startsWith('8')) digits = digits.slice(1);
    if (digits.startsWith('7')) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let out = '+7';
    if (digits.length > 0) out += ' (' + digits.slice(0, 3);
    if (digits.length >= 3) out += ')';
    if (digits.length > 3) out += ' ' + digits.slice(3, 6);
    if (digits.length > 6) out += '-' + digits.slice(6, 8);
    if (digits.length > 8) out += '-' + digits.slice(8, 10);
    input.value = out;
  });
}
