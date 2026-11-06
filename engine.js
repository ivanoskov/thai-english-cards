export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function maskedExamples(card) {
  const escaped = card.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
  return card.examples.flatMap((example, index) => {
    const text = example.replace(pattern, '____');
    return text === example ? [] : [{ text, index }];
  });
}

export function chooseCloze(card, random = Math.random) {
  if (random() >= 0.5) return null;
  const options = maskedExamples(card);
  return options.length ? options[Math.floor(random() * options.length)] : null;
}

export function newQueue(cards, known = [], hidden = [], random = Math.random) {
  const excluded = new Set([...known, ...hidden]);
  return shuffle(cards.filter(card => !excluded.has(card.id)).map(card => card.id), random);
}

export function grade(state, isKnown, random = Math.random) {
  if (!state.queue.length) return state;
  const [id, ...queue] = state.queue;
  let known = [...state.known];
  if (isKnown) known = [...new Set([...known, id])];
  else {
    const min = Math.min(3, queue.length);
    const index = min + Math.floor(random() * (queue.length - min + 1));
    queue.splice(index, 0, id);
  }
  return { ...state, known, queue };
}

export function exclude(state, id = state.queue[0]) {
  if (!Number.isInteger(id)) return state;
  return { ...state, hidden: [...new Set([...state.hidden, id])], known: state.known.filter(value => value !== id), queue: state.queue.filter(value => value !== id) };
}

export function restart(state, cards) {
  return { ...state, known: [], queue: newQueue(cards, [], state.hidden) };
}

export function restore(raw, cards) {
  const ids = new Set(cards.map(card => card.id));
  const clean = values => [...new Set(Array.isArray(values) ? values.filter(id => ids.has(id)) : [])];
  const hidden = clean(raw?.hidden);
  const known = clean(raw?.known).filter(id => !hidden.includes(id));
  const eligible = new Set(cards.filter(card => !known.includes(card.id) && !hidden.includes(card.id)).map(card => card.id));
  const queue = clean(raw?.queue).filter(id => eligible.has(id));
  const missing = [...eligible].filter(id => !queue.includes(id));
  // Older versions stored a single topic. Merge all words and shuffle new additions.
  const restoredQueue = raw?.version === 2 && !missing.length ? queue : shuffle([...queue, ...missing]);
  return { version: 2, reverse: raw?.reverse === true, known, hidden, queue: restoredQueue };
}
