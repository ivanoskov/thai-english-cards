import test from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../cards.js';
import { shuffle, newQueue, grade, restore, exclude, restart, chooseDirection } from '../engine.js';

test('160 unique words, stable original ids, three different examples per word', () => {
  assert.equal(cards.length, 160);
  assert.equal(new Set(cards.map(card => card.id)).size, 160);
  assert.equal(new Set(cards.map(card => card.en)).size, 160);
  assert.equal(cards.find(card => card.id === 1).en, 'say');
  assert.equal(cards.find(card => card.id === 60).en, 'another');
  assert.ok(cards.every(card => card.ru && card.en && !card.topic && card.examples.length === 3 && new Set(card.examples).size === 3 && card.examples.every(value => typeof value === 'string' && value.length > 8)));
  for (const en of ['raw', 'cooked', 'undercooked', 'thing', 'object', 'item']) assert.ok(cards.some(card => card.en === en));
});
test('shuffle preserves input and includes all eligible words, without topic filtering', () => {
  const source = cards.map(card => card.id);
  const mixed = shuffle(source, () => 0);
  assert.notDeepEqual(mixed, source);
  assert.deepEqual([...mixed].sort((a,b) => a-b), source);
  assert.equal(source[0], 1);
  const queue = newQueue(cards, [1,2], [3,4]);
  assert.equal(queue.length, 156);
  assert.ok(queue.every(id => ![1,2,3,4].includes(id)));
});
test('repeat delays a word and never duplicates or loses it, including a one-word deck', () => {
  const state = { version:2, mode:'ru-en', known:[], hidden:[], queue:[1,2,3,4,5,6] };
  const next = grade(state, false, () => 0);
  assert.deepEqual(next.queue, [2,3,4,1,5,6]);
  assert.deepEqual(state.queue, [1,2,3,4,5,6]);
  assert.equal(new Set(next.queue).size, 6);
  assert.deepEqual(grade({...state, queue:[1]}, false).queue, [1]);
});
test('excluded words stay excluded across marking, reload, mode changes and a new round', () => {
  let state = restore(null, cards);
  const id = state.queue[0];
  state = exclude(state);
  assert.ok(state.hidden.includes(id));
  assert.ok(!state.queue.includes(id));
  const reloaded = restore(JSON.parse(JSON.stringify({...state, mode:'mixed'})), cards);
  assert.ok(!reloaded.queue.includes(id));
  assert.equal(reloaded.mode,'mixed');
  const freshRound = restart(grade(reloaded, true), cards);
  assert.ok(!freshRound.queue.includes(id));
  assert.equal(freshRound.queue.length,159);
  assert.equal(state.known.length,0);
});
test('migration keeps previous learned words and ignores removed topic groups', () => {
  const state = restore({topic:'Отель', known:[1,2,999],queue:[28,29],reverse:true}, cards);
  assert.equal(state.version,2);
  assert.equal(state.queue.length,158);
  assert.deepEqual(state.known,[1,2]);
  assert.equal(state.mode,'en-ru');
  assert.ok(state.queue.includes(160));
  assert.equal(state.topic,undefined);
});
test('fixed modes keep their direction and mixed mode can pick either', () => {
  assert.equal(chooseDirection('ru-en', () => 0), 'ru-en');
  assert.equal(chooseDirection('en-ru', () => 0.99), 'en-ru');
  assert.equal(chooseDirection('mixed', () => 0), 'en-ru');
  assert.equal(chooseDirection('mixed', () => 0.99), 'ru-en');
});
test('adding words interleaves missing ids, reload of unchanged deck preserves its order', () => {
  const state = restore(null,cards);
  assert.deepEqual(restore(JSON.parse(JSON.stringify(state)),cards),state);
  const small = restore(null,cards.slice(0,60));
  const expanded = restore(small,cards);
  assert.equal(expanded.queue.length,160);
  assert.equal(new Set(expanded.queue).size,160);
});
test('a full pass remains complete on reload, restart brings back known but not hidden', () => {
  let state = exclude(restore(null,cards));
  const hidden = state.hidden[0];
  for (let i=0;i<159;i++) state=grade(state,true);
  assert.equal(state.queue.length,0);
  assert.equal(restore(state,cards).queue.length,0);
  const fresh = restart(state,cards);
  assert.equal(fresh.queue.length,159);
  assert.ok(!fresh.queue.includes(hidden));
});
test('corrupted storage and overlap are repaired, all-hidden deck stays empty', () => {
  const state = restore({known:[1,1,2,999],hidden:[1,999],queue:[1,2,3,3,999]},cards);
  assert.deepEqual(state.hidden,[1]);
  assert.deepEqual(state.known,[2]);
  assert.equal(state.queue.length,158);
  assert.equal(restore({known:'bad',hidden:'bad',queue:42},cards).queue.length,160);
  const allHidden = restore({hidden:cards.map(card=>card.id)},cards);
  assert.equal(restart(allHidden,cards).queue.length,0);
});
