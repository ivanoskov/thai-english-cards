import test from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../cards.js';
import { maskedExamples, chooseCloze } from '../engine.js';

test('mask all whole-word occurrences, including initial capitals and punctuation', () => {
  const card = { en:'raw', examples:['Raw fish, not raw meat.','Is it raw?'] };
  assert.deepEqual(maskedExamples(card),[
    {text:'____ fish, not ____ meat.',index:0},
    {text:'Is it ____?',index:1},
  ]);
  assert.equal(card.examples[0],'Raw fish, not raw meat.');
});
test('mask phrases as a unit and skip unrelated forms or substrings', () => {
  assert.deepEqual(maskedExamples({en:'turn on',examples:['Turn on the light.','Turn off the light.']}),[{text:'____ the light.',index:0}]);
  assert.deepEqual(maskedExamples({en:'ice',examples:['Nice rice.','No ice, please.']}),[{text:'No ____, please.',index:1}]);
  assert.deepEqual(maskedExamples({en:'grow up',examples:['I grew up here.']}),[]);
});
test('offer clues on about half of presentations and choose among matching examples', () => {
  const card = {en:'raw',examples:['Is it raw?','No raw fish, please.']};
  assert.equal(chooseCloze(card,()=>0.7),null);
  assert.deepEqual(chooseCloze(card,()=>0),{text:'Is it ____?',index:0});
  const values=[0.1,0.99];
  assert.deepEqual(chooseCloze(card,()=>values.shift()),{text:'No ____ fish, please.',index:1});
  assert.equal(chooseCloze({en:'missing',examples:['An unrelated sentence.']},()=>0),null);
});
test('every real card has at least one safe example with the target removed', () => {
  for (const card of cards) {
    const options=maskedExamples(card);
    assert.ok(options.length,card.en);
    assert.ok(options.every(option=>option.text.includes('____')),card.en);
    assert.ok(options.every(option=>option.text!==card.examples[option.index]),card.en);
  }
});
