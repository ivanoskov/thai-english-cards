import { cards } from './cards.js?v=6';
import { newQueue, grade, restore, exclude, restart, chooseCloze, chooseDirection } from './engine.js?v=6';

const $ = id => document.getElementById(id);
const key = 'travel-cards-v1';
const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
const hasAudio = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const byId = new Map(cards.map(card => [card.id, card]));
const modePicker = $('mode-picker');
const modeOptions = [...modePicker.querySelectorAll('[data-mode]')];
let raw = null;
try { raw = JSON.parse(localStorage.getItem(key)); } catch { /* Empty or unavailable storage. */ }
let state = restore(raw, cards);
let revealed = false;
let clueCardId = null;
let clue = null;
let cardDirection;
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
  const selectedMode = modeOptions.find(option => option.dataset.mode === state.mode);
  $('direction-label').textContent = selectedMode.dataset.short;
  $('direction-icon').setAttribute('href', `#icon-${state.mode}`);
  $('direction').setAttribute('aria-label', `Выбрать режим. Сейчас: ${selectedMode.textContent.trim()}`);
  for (const option of modeOptions) option.setAttribute('aria-pressed', String(option === selectedMode));
  const showActions = !!card && revealed;
  $('actions').hidden = !showActions;
  $('controls').classList.toggle('has-actions', showActions);
  $('practice').hidden = !card;
  $('complete').hidden = !!card;
  if (card) {
    if (clueCardId !== card.id) {
      clueCardId = card.id;
      clue = chooseCloze(card);
      cardDirection = chooseDirection(state.mode);
    }
    const reverse = cardDirection === 'en-ru';
    $('prompt').textContent = reverse ? card.en : card.ru;
    $('prompt').lang = reverse ? 'en' : 'ru';
    $('answer').textContent = reverse ? card.ru : card.en;
    $('answer').lang = reverse ? 'ru' : 'en';
    $('clue').textContent = clue?.text || '';
    $('clue').hidden = revealed || !clue;
    $('card').classList.toggle('revealed', revealed);
    $('translation').hidden = !revealed;
    $('examples').hidden = !revealed;
    $('reveal').setAttribute('aria-expanded', String(revealed));
    $('reveal').setAttribute('aria-label', revealed ? 'Скрыть перевод' : 'Показать перевод');
    $('speak-word').hidden = !hasAudio;
    $('examples').replaceChildren();
    if (revealed) {
      const examples = clue ? [card.examples[clue.index], ...card.examples.filter((_, index) => index !== clue.index)] : card.examples;
      for (const text of examples) {
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
  clueCardId = null;
  render();
}

$('speak-word').innerHTML = icon;
$('reveal').addEventListener('click', flip);
$('card').addEventListener('click', event => { if (!revealed && !event.target.closest('button')) flip(); });
$('known').addEventListener('click', () => assess(true));
$('again').addEventListener('click', () => assess(false));
$('direction').addEventListener('click', () => {
  stopAudio();
  modePicker.showModal();
  modeOptions.find(option => option.dataset.mode === state.mode).focus();
});
$('close-mode').addEventListener('click', () => modePicker.close());
for (const option of modeOptions) {
  option.addEventListener('click', () => {
    if (state.mode !== option.dataset.mode) {
      state.mode = option.dataset.mode;
      cardDirection = chooseDirection(state.mode);
      revealed = false;
      render();
    }
    modePicker.close();
  });
}
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
  stopAudio(); state = { ...previous, mode: state.mode }; revealed = false; clearNotice(); render();
});
$('restart').addEventListener('click', () => {
  clearNotice(); stopAudio(); state = restart(state, cards); revealed = false; clueCardId = null; render();
});
$('restore-hidden').addEventListener('click', () => {
  clearNotice(); state = { ...state, hidden: [] }; state.queue = newQueue(cards, state.known, []); revealed = false; render();
});
$('speak-word').addEventListener('click', () => { const card = byId.get(state.queue[0]); if (card) speak(card.en, $('speak-word')); });
document.addEventListener('keydown', event => {
  if (modePicker.open || event.target.closest('button, input, textarea, select')) return;
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
      if (sessionStorage.getItem('travel-cards-release-v6')) return;
      sessionStorage.setItem('travel-cards-release-v6', '1');
    } catch { return; }
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(() => {});
}
