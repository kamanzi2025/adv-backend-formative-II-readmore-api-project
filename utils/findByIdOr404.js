const mongoose = require('mongoose');
const HttpError = require('./HttpError');

// Load a document by the id in the URL, or answer 404.
// A malformed id (e.g. "abc") can't match any document, so it is a 404 too
// rather than a crash from Mongoose failing to cast it.
async function findByIdOr404(Model, id, label) {
  const doc = mongoose.isObjectIdOrHexString(id) ? await Model.findById(id) : null;
  if (!doc) throw new HttpError(404, `No ${label} found with id ${id}`);
  return doc;
}

module.exports = findByIdOr404;
