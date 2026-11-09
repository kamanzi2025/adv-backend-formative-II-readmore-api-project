const Author = require('../models/Author');
const Book = require('../models/Book');
const HttpError = require('../utils/HttpError');

// Requirement 1: `required` only checks that an id was sent, not that an
// author with that id exists, so we have to look it up.
async function ensureAuthorExists(authorId) {
  const exists = await Author.exists({ _id: authorId });
  if (!exists) {
    throw new HttpError(400, `Cannot save book: no author exists with id ${authorId}`);
  }
}

// Requirement 2: titles are unique per author, ignoring case.
// The collation matches the unique index on Book, so this query uses it.
async function ensureTitleIsFree(book) {
  const duplicate = await Book.findOne({
    author: book.author,
    title: book.title,
    _id: { $ne: book._id }, // on update, the book itself isn't a duplicate
  }).collation(Book.TITLE_COLLATION);

  if (duplicate) {
    throw new HttpError(409, `This author already has a book titled "${duplicate.title}"`);
  }
}

// Run every rule on a new or edited (not yet saved) book.
// The database checks only run when the fields they depend on are new or changed.
async function validateBook(book) {
  await book.validate();

  const authorChanged = book.isNew || book.isModified('author');
  if (authorChanged) await ensureAuthorExists(book.author);
  if (authorChanged || book.isModified('title')) await ensureTitleIsFree(book);
}

module.exports = { validateBook };
