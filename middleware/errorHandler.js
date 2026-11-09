const mongoose = require('mongoose');
const HttpError = require('../utils/HttpError');

function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

// Express 5 forwards errors thrown in async controllers here automatically.
// Express recognises an error handler by its four parameters, so `next` stays even though it's unused.
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  // Missing required fields or values of the wrong type (e.g. price: "abc").
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) =>
      e instanceof mongoose.Error.CastError ? `${e.path} has an invalid value` : e.message
    );
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // Unique index violation: two requests created the same author/title at once.
  if (err.code === 11000) {
    return res.status(409).json({ message: 'This author already has a book with that title' });
  }

  // Body that isn't valid JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
}

module.exports = { notFound, errorHandler };
