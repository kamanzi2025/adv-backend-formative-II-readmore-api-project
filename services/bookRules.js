const Book = require('../models/Book');
const HttpError = require('../utils/HttpError');
const pick = require('../utils/pick');
const { reserveBook, releaseBook } = require('./authorBookCount');

const BOOK_FIELDS = ['title', 'genre', 'price', 'publishedYear', 'author'];
const NUMERIC_FIELDS = ['price', 'publishedYear'];
const EARLIEST_YEAR = 1450; // roughly when the printing press arrived

// Take only the book fields from a request body. Mongoose would quietly turn
// `true` into 1 for a Number field, so anything that isn't a number or a
// numeric string is refused here, before that conversion happens.
function readBookInput(body) {
  const input = pick(body ?? {}, BOOK_FIELDS);
  for (const field of NUMERIC_FIELDS) {
    const value = input[field];
    if (value != null && typeof value !== 'number' && typeof value !== 'string') {
      throw new HttpError(400, `${field} must be a number`);
    }
  }
  return input;
}

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

// Check every rule, then save a new or edited book, cheapest check first:
// field shape (400), value rules (422), duplicate title (409), author exists (400).
// `previousAuthorId` is the book's author before an update (null for a new book).
async function saveBook(book, previousAuthorId = null) {
  await book.validate();
  checkBookValues(book);

  const authorChanged = !previousAuthorId || !book.author.equals(previousAuthorId);
  if (authorChanged || book.isModified('title')) await ensureTitleIsFree(book);

  // Requirement 1: claiming a place on the author fails if they don't exist.
  if (authorChanged) await reserveBook(book.author);
  try {
    await book.save({ validateBeforeSave: false }); // already validated above
  } catch (err) {
    if (authorChanged) await releaseBook(book.author); // nothing was saved
    throw err;
  }
  if (authorChanged && previousAuthorId) await releaseBook(previousAuthorId);
}

module.exports = { readBookInput, saveBook };
