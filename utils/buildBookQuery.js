const mongoose = require('mongoose');
const HttpError = require('./HttpError');

const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];

// Treat user text as literal characters inside a regular expression,
// so a search for "c++" or "(" doesn't break the query.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Read one query param as a trimmed string; undefined when absent or empty.
function readParam(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${name} must be given at most once`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readNumber(query, name) {
  const raw = readParam(query, name);
  if (raw === undefined) return undefined;
  const number = Number(raw);
  if (!Number.isFinite(number)) throw new HttpError(400, `${name} must be a number`);
  return number;
}

// Requirement 5: turn GET /books query params into a Mongo filter and sort.
// Each param adds its own condition only when present, so any
// combination works and no params means "everything".
function buildBookQuery(query) {
  const filter = {};

  const genre = readParam(query, 'genre');
  if (genre) filter.genre = new RegExp(`^${escapeRegex(genre)}$`, 'i');

  const minPrice = readNumber(query, 'minPrice');
  const maxPrice = readNumber(query, 'maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, 'minPrice cannot be greater than maxPrice');
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const author = readParam(query, 'author');
  if (author) {
    if (!mongoose.isObjectIdOrHexString(author)) {
      throw new HttpError(400, 'author must be a valid author id');
    }
    filter.author = author;
  }

  const search = readParam(query, 'search');
  if (search) filter.title = new RegExp(escapeRegex(search), 'i');

  const sortField = readParam(query, 'sort');
  const order = (readParam(query, 'order') || 'asc').toLowerCase();
  if (sortField && !SORTABLE_FIELDS.includes(sortField)) {
    throw new HttpError(400, `sort must be one of: ${SORTABLE_FIELDS.join(', ')}`);
  }
  if (order !== 'asc' && order !== 'desc') {
    throw new HttpError(400, 'order must be asc or desc');
  }
  // _id as a tie-breaker keeps the order stable, so results come back in the same order every time.
  const sort = sortField ? { [sortField]: order === 'asc' ? 1 : -1, _id: 1 } : { _id: 1 };

  return { filter, sort };
}

module.exports = buildBookQuery;
