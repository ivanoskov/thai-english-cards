import test from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../cards.js';
import { shuffle, selected, newQueue, grade, restore } from '../engine.js';

test('all 60 source cards have unique ids, content and expected topics', () => {
  assert.equal(cards.length, 60);
  assert.equal(new Set(cards.map(card => card.id)).size, 60);
  assert.equal(new Set(cards.map(card => card.en)).size, 60);
  assert.ok(cards.every(card => card.ru && card.en && card.example && card.topic));
  assert.deepEqual(['Главное','Ресторан','Отель','Поездки','Общение'].map(topic => selected(cards, topic).length), [15,12,10,13,10]);
});
test('random queue contains every eligible card exactly once, preserving source', () => {
  const source = cards.map(card => card.id);
  const mixed = shuffle(source, () => 0);
  assert.notDeepEqual(mixed, source);
  assert.deepEqual([...mixed].sort((a,b) => a-b), source);
  assert.equal(source[0], 1);
  const queue = newQueue(cards, 'Отель', [28]);
  assert.equal(queue.length, 9);
  assert.ok(!queue.includes(28));
});
test('repeat schedules a failed word later, does not lose or duplicate it', () => {
  const state = { topic:'all', reverse:false, known:[], queue:[1,2,3,4,5,6] };
  const next = grade(state, false, () => 0);
  assert.deepEqual(next.queue, [2,3,4,1,5,6]);
  assert.deepEqual(state.queue, [1,2,3,4,5,6]);
  assert.equal(new Set(next.queue).size, 6);
  assert.deepEqual(grade({...state, queue:[1]}, false).queue, [1]);
});
test('marking known completes a deck and survives restoration', () => {
  let state = restore(null, cards);
  for (let i=0; i<60; i++) state = grade(state, true);
  assert.equal(state.queue.length, 0);
  assert.equal(state.known.length, 60);
  assert.equal(restore(JSON.parse(JSON.stringify(state)), cards).queue.length, 0);
});
test('restoration repairs corrupt storage and filtered queues', () => {
  const state = restore({topic:'Отель', known:[28,28,999],queue:[999,1,29,29],reverse:true}, cards);
  assert.deepEqual(state.known,[28]);
  assert.equal(state.queue[0],29);
  assert.equal(state.queue.length,9);
  assert.equal(new Set(state.queue).size,9);
  assert.ok(state.queue.every(id => selected(cards,'Отель').some(card=>card.id===id)));
  assert.equal(restore({topic:'bad',known:'oops',queue:42},cards).queue.length,60);
});
