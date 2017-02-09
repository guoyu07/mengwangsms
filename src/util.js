function getRandom(min, max) {
  const range = max - min;
  const rand = Math.random();
  return min + Math.round(rand * range);
}

export function uniqId() {
  return `${Date.now()}${getRandom(100, 999)}`;
}
