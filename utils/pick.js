// Copy only the listed keys that are present in `source`.
// Stops clients from setting fields they shouldn't (e.g. _id, createdAt).
function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

module.exports = pick;
