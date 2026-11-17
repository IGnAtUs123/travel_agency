export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function formatPrice(n) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(n))} руб.`;
}

export function daysLabel(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

let flashMessage = null;
let flashTimer = null;
export const setFlash = (msg) => {
  flashMessage = msg;
};
export const takeFlash = () => {
  const m = flashMessage;
  if (m && !flashTimer) {
    flashTimer = setTimeout(() => {
      flashMessage = null;
      flashTimer = null;
    }, 1000);
  }
  return m;
};
