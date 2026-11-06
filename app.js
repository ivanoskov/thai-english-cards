import { cards } from './cards.js';
import { newQueue, grade, restore, exclude, restart } from './engine.js';

const $ = id => document.getElementById(id);
const key = 'travel-cards-v1';
const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
const hasAudio = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const byId = new Map(cards.map(card => [card.id, card]));
let raw = null;
try { raw = JSON.parse(localStorage.getItem(key)); } catch { /* Empty or unavailable storage. */ }
let state = restore(raw, cards);
let revealed = false;
let previous = null;
let toastTimer;
let activeUtterance = null;
let activeButton = null;

function notice(text, allowUndo = false) {
  clearTimeout(toastTimer);
  $('toast-text').textContent = text;
  $('toast').hidden = false;
  $('undo').hidden = !allowUndo;
  toastTimer = setTimeout(() => { $('toast').hidden = true; previous = null; }, allowUndo ? 9000 : 6000);
}

function clearNotice() {
  clearTimeout(toastTimer);
  $('toast').hidden = true;
  previous = null;
}

function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { return false; }
}

function stopAudio() {
  activeUtterance = null;
  if (activeButton) { activeButton.classList.remove('is-speaking'); activeButton.setAttribute('aria-pressed', 'false'); }
  activeButton = null;
  if (hasAudio) speechSynthesis.cancel();
}

function speak(text, button) {
  if (!hasAudio) return;
  const wasPlaying = activeButton === button;
  stopAudio();
  if (wasPlaying) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(voice => voice.lang.toLowerCase() === 'en-gb') || voices.find(voice => voice.lang.toLowerCase().startsWith('en'));
  if (voice) utterance.voice = voice;
  activeUtterance = utterance;
  activeButton = button;
  button.classList.add('is-speaking');
  button.setAttribute('aria-pressed', 'true');
  function finish() {
    if (activeUtterance !== utterance) return;
    button.classList.remove('is-speaking');
    button.setAttribute('aria-pressed', 'false');
    activeUtterance = null;
    activeButton = null;
  }
  utterance.onend = finish;
  utterance.onerror = event => {
    if (activeUtterance !== utterance) return;
    finish();
    if (!['canceled', 'interrupted'].includes(event.error)) notice('Озвучка недоступна. Проверь английский голос в настройках устройства.');
  };
  speechSynthesis.speak(utterance);
}

function render() {
  const card = byId.get(state.queue[0]);
  $('direction').textContent = state.reverse ? 'EN → RU' : 'RU → EN';
  $('direction').setAttribute('aria-label', state.reverse ? 'Английский → русский. Сменить направление' : 'Русский → английский. Сменить направление');
  $('practice').hidden = !card;
  $('complete').hidden = !!card;
  if (card) {
    $('prompt').textContent = state.reverse ? card.en : card.ru;
    $('prompt').lang = state.reverse ? 'en' : 'ru';
    $('answer').textContent = state.reverse ? card.ru : card.en;
    $('answer').lang = state.reverse ? 'ru' : 'en';
    $('card').classList.toggle('revealed', revealed);
    $('translation').hidden = !revealed;
    $('examples').hidden = !revealed;
    $('actions').hidden = !revealed;
    $('reveal').setAttribute('aria-expanded', String(revealed));
    $('reveal').setAttribute('aria-label', revealed ? 'Скрыть перевод' : 'Показать перевод');
    $('speak-word').hidden = !hasAudio;
    $('examples').replaceChildren();
    if (revealed) {
      for (const text of card.examples) {
        const example = document.createElement(hasAudio ? 'button' : 'p');
        example.className = hasAudio ? 'example' : 'example no-audio';
        example.lang = 'en';
        if (hasAudio) {
          example.type = 'button';
          example.innerHTML = icon;
          example.setAttribute('aria-label', `Послушать: ${text}`);
          example.setAttribute('aria-pressed', 'false');
          example.addEventListener('click', () => speak(text, example));
        }
        const label = document.createElement('span');
        label.textContent = text;
        example.append(label);
        $('examples').append(example);
      }
    }
  } else {
    const allHidden = state.hidden.length === cards.length;
    $('complete-title').textContent = allHidden ? 'Все слова убраны' : 'Круг пройден';
    $('restart').hidden = allHidden;
    $('restore-hidden').hidden = !state.hidden.length;
  }
  save();
}

function flip() {
  if (!state.queue.length) return;
  stopAudio();
  revealed = !revealed;
  render();
}

function assess(isKnown) {
  if (!revealed) return;
  clearNotice();
  stopAudio();
  state = grade(state, isKnown);
  revealed = false;
  render();
}

$('speak-word').innerHTML = icon;
$('reveal').addEventListener('click', flip);
$('card').addEventListener('click', event => { if (!revealed && !event.target.closest('button')) flip(); });
$('known').addEventListener('click', () => assess(true));
$('again').addEventListener('click', () => assess(false));
$('direction').addEventListener('click', () => { stopAudio(); state.reverse = !state.reverse; revealed = false; render(); });
$('exclude').addEventListener('click', () => {
  if (!state.queue.length) return;
  clearNotice();
  stopAudio();
  previous = structuredClone(state);
  state = exclude(state);
  revealed = false;
  render();
  notice(save() ? 'Слово убрано на этом устройстве' : 'Слово убрано до закрытия вкладки: браузер не сохраняет данные', true);
});
$('undo').addEventListener('click', () => {
  if (!previous) return;
  stopAudio(); state = previous; revealed = false; clearNotice(); render();
});
$('restart').addEventListener('click', () => {
  clearNotice(); stopAudio(); state = restart(state, cards); revealed = false; render();
});
$('restore-hidden').addEventListener('click', () => {
  clearNotice(); state = { ...state, hidden: [] }; state.queue = newQueue(cards, state.known, []); revealed = false; render();
});
$('speak-word').addEventListener('click', () => { const card = byId.get(state.queue[0]); if (card) speak(card.en, $('speak-word')); });
document.addEventListener('keydown', event => {
  if (event.target.closest('button, input, textarea, select')) return;
  if (event.key === ' ' && state.queue.length) { event.preventDefault(); flip(); }
  if (event.key === 'ArrowLeft') assess(false);
  if (event.key === 'ArrowRight') assess(true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
render();
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !navigator.serviceWorker.controller) return;
    try {
      if (sessionStorage.getItem('travel-cards-release-v2')) return;
      sessionStorage.setItem('travel-cards-release-v2', '1');
    } catch { return; }
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(() => {});
}
