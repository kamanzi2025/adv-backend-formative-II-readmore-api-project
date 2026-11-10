const mongoose = require('mongoose');
const HttpError = require('./HttpError');

// Load a document by the id in the URL, or answer 404.
// A malformed id (e.g. "abc") can't match any document, so it is a 404 too
// rather than a crash from Mongoose failing to cast it.
// `method` lets a caller use another by-id lookup, such as findByIdAndDelete.
async function findByIdOr404(Model, id, label, method = 'findById') {
  const doc = mongoose.isObjectIdOrHexString(id) ? await Model[method](id) : null;
  if (!doc) throw new HttpError(404, `No ${label} found with id ${id}`);
  return doc;
}

module.exports = findByIdOr404;
