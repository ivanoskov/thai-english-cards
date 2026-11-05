export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selected(cards, topic) {
  return cards.filter(card => topic === 'all' || card.topic === topic);
}

export function newQueue(cards, topic, known, random = Math.random) {
  return shuffle(selected(cards, topic).filter(card => !known.includes(card.id)).map(card => card.id), random);
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

export function restore(raw, cards) {
  const topics = new Set(['all', ...cards.map(card => card.topic)]);
  const topic = topics.has(raw?.topic) ? raw.topic : 'all';
  const ids = new Set(cards.map(card => card.id));
  const known = [...new Set(Array.isArray(raw?.known) ? raw.known.filter(id => ids.has(id)) : [])];
  const eligible = new Set(selected(cards, topic).filter(card => !known.includes(card.id)).map(card => card.id));
  const saved = Array.isArray(raw?.queue) ? raw.queue : [];
  const queue = [...new Set(saved.filter(id => eligible.has(id)))];
  const missing = [...eligible].filter(id => !queue.includes(id));
  return { topic, reverse: raw?.reverse === true, known, queue: [...queue, ...shuffle(missing)] };
}
