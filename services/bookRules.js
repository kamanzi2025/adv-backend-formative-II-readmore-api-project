const Author = require('../models/Author');
const Book = require('../models/Book');
const HttpError = require('../utils/HttpError');

const EARLIEST_YEAR = 1450; // roughly when the printing press arrived

// Requirement 3: value rules a static schema can't express
// ("not in the future" changes every year). Expects a Mongoose-validated book,
// so price and publishedYear are already numbers.
function checkBookValues(book) {
  const problems = [];
  const currentYear = new Date().getFullYear();

  if (book.price <= 0) {
    problems.push('price must be greater than 0');
  }
  if (!Number.isInteger(book.publishedYear)) {
    problems.push('publishedYear must be a whole number');
  } else if (book.publishedYear > currentYear) {
    problems.push(`publishedYear cannot be in the future (after ${currentYear})`);
  } else if (book.publishedYear < EARLIEST_YEAR) {
    problems.push(`publishedYear cannot be before ${EARLIEST_YEAR}`);
  }

  if (problems.length) {
    throw new HttpError(422, `Invalid book: ${problems.join('; ')}`);
  }
}

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

// Run every rule on a new or edited (not yet saved) book, cheapest first:
// field shape (400), value rules (422), author exists (400), duplicate title (409).
// The database checks only run when the fields they depend on are new or changed.
async function validateBook(book) {
  await book.validate();
  checkBookValues(book);

  const authorChanged = book.isNew || book.isModified('author');
  if (authorChanged) await ensureAuthorExists(book.author);
  if (authorChanged || book.isModified('title')) await ensureTitleIsFree(book);
}

module.exports = { validateBook };
