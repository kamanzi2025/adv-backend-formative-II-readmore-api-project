const Author = require('../models/Author');
const HttpError = require('../utils/HttpError');

// Requirements 1 and 4 without race conditions.
//
// Checking "does the author exist?" and then inserting a book is two steps, and
// so is checking "does the author have books?" and then deleting them. A
// create and a delete arriving together can each pass their check before the
// other writes, leaving an orphan book. Each function below does its check and
// its change in ONE atomic operation on the author document, so whichever
// request reaches the author first wins and the other is refused.
// (A transaction would also work, but needs a replica set such as Atlas;
// this works on a plain local MongoDB too.)

// Claim a place for a new book. Fails with 400 if the author doesn't exist.
async function reserveBook(authorId) {
  const author = await Author.findOneAndUpdate({ _id: authorId }, { $inc: { bookCount: 1 } });
  if (!author) {
    throw new HttpError(400, `Cannot save book: no author exists with id ${authorId}`);
  }
}

// Give the place back when a book is deleted, moved away, or failed to save.
async function releaseBook(authorId) {
  await Author.updateOne({ _id: authorId, bookCount: { $gt: 0 } }, { $inc: { bookCount: -1 } });
}

// Delete the author only if no book holds a place. Returns false if one does.
async function deleteIfNoBooks(authorId) {
  const deleted = await Author.findOneAndDelete({ _id: authorId, bookCount: 0 });
  return Boolean(deleted);
}

module.exports = { reserveBook, releaseBook, deleteIfNoBooks };
