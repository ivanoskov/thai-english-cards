import { cards } from './cards.js';
import { selected, newQueue, grade, restore } from './engine.js';

const $ = id => document.getElementById(id);
const key = 'travel-cards-v1';
let raw = null;
let storageWorks = true;
try { raw = JSON.parse(localStorage.getItem(key)); } catch { storageWorks = false; }
let state = restore(raw, cards);
let revealed = false;
let previous = null;
const byId = new Map(cards.map(card => [card.id, card]));

function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { storageWorks = false; }
  $('storage-note').textContent = storageWorks ? 'Прогресс сохраняется на этом устройстве' : 'Прогресс доступен до закрытия страницы';
}

function render(message) {
  const scope = selected(cards, state.topic);
  const count = scope.filter(card => state.known.includes(card.id)).length;
  const card = byId.get(state.queue[0]);
  $('topic').value = state.topic;
  $('direction').textContent = state.reverse ? 'EN → RU' : 'RU → EN';
  $('direction').setAttribute('aria-label', state.reverse ? 'Сейчас английский → русский. Сменить направление' : 'Сейчас русский → английский. Сменить направление');
  $('practice').hidden = !card;
  $('complete').hidden = !!card;
  $('undo').hidden = !previous;
  $('undo-complete').hidden = !previous;
  if (card) {
    $('progress-text').textContent = `Знаю ${count} из ${scope.length}`;
    $('remaining').textContent = `Осталось ${state.queue.length}`;
    $('progress').max = scope.length;
    $('progress').value = count;
    $('card-topic').textContent = card.topic;
    $('card-label').textContent = state.reverse ? 'Вспомни перевод' : 'Вспомни по-английски';
    $('prompt').textContent = state.reverse ? card.en : card.ru;
    $('prompt').lang = state.reverse ? 'en' : 'ru';
    $('answer').textContent = state.reverse ? card.ru : card.en;
    $('answer').lang = state.reverse ? 'ru' : 'en';
    $('example').textContent = card.example;
    $('hint').hidden = revealed;
    $('answer').hidden = !revealed;
    $('example').hidden = !revealed;
    $('speak').hidden = !revealed || !('speechSynthesis' in window);
    $('actions').hidden = !revealed;
    $('show').hidden = revealed;
    $('card').classList.toggle('revealed', revealed);
    $('reveal').setAttribute('aria-label', revealed ? 'Ответ открыт' : 'Показать ответ');
    $('reveal').setAttribute('aria-expanded', String(revealed));
    $('status').textContent = message || (revealed ? 'Скажи свою фразу с этим словом. Потом оцени себя.' : 'Вспомни вслух или про себя. Потом проверь.');
  } else {
    $('complete-text').textContent = `Все ${scope.length} карточек ${state.topic === 'all' ? 'этого набора' : 'этой темы'} отмечены как знакомые.`;
  }
  save();
}

function reveal() {
  if (revealed || !state.queue.length) return;
  revealed = true;
  render();
}

function assess(isKnown) {
  if (!revealed) return;
  previous = structuredClone(state);
  state = grade(state, isKnown);
  revealed = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  render(isKnown ? 'Отмечено. Следующее слово.' : state.queue.length > 1 ? 'Это слово вернётся после других карточек.' : 'Осталось одно слово. Попробуй ещё раз.');
}

$('reveal').addEventListener('click', reveal);
$('show').addEventListener('click', reveal);
$('known').addEventListener('click', () => assess(true));
$('again').addEventListener('click', () => assess(false));
function undo() {
  if (!previous) return;
  state = previous;
  previous = null;
  revealed = true;
  render('Последняя оценка отменена.');
}
$('undo').addEventListener('click', undo);
$('undo-complete').addEventListener('click', undo);
$('topic').addEventListener('change', event => {
  state.topic = event.target.value;
  state.queue = newQueue(cards, state.topic, state.known);
  previous = null;
  revealed = false;
  render();
});
$('direction').addEventListener('click', () => {
  state.reverse = !state.reverse;
  revealed = false;
  render();
});
$('restart').addEventListener('click', () => {
  const scope = new Set(selected(cards, state.topic).map(card => card.id));
  state.known = state.known.filter(id => !scope.has(id));
  state.queue = newQueue(cards, state.topic, state.known);
  previous = null;
  revealed = false;
  render('Новый круг. Карточки снова перемешаны.');
});
$('speak').addEventListener('click', () => {
  const card = byId.get(state.queue[0]);
  if (!card || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(card.en);
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  const voice = speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase() === 'en-gb') || speechSynthesis.getVoices().find(voice => voice.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  utterance.onerror = () => { $('status').textContent = 'Озвучка недоступна. Можно продолжить без неё.'; };
  speechSynthesis.speak(utterance);
});
document.addEventListener('keydown', event => {
  if (event.target.closest('select, button, input, textarea')) return;
  if (event.key === ' ' && state.queue.length) { event.preventDefault(); reveal(); }
  if (event.key === 'ArrowLeft') assess(false);
  if (event.key === 'ArrowRight') assess(true);
});
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
