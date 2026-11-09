const Author = require('../models/Author');
const HttpError = require('../utils/HttpError');

// Requirement 1: `required` only checks that an id was sent, not that an
// author with that id exists, so we have to look it up.
async function ensureAuthorExists(authorId) {
  const exists = await Author.exists({ _id: authorId });
  if (!exists) {
    throw new HttpError(400, `Cannot save book: no author exists with id ${authorId}`);
  }
}

// Run every rule on a new or edited (not yet saved) book.
// The author check only runs when the author is new or changed.
async function validateBook(book) {
  await book.validate();
  if (book.isNew || book.isModified('author')) await ensureAuthorExists(book.author);
}

module.exports = { validateBook };
