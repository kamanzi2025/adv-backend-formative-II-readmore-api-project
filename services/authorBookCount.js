const Author = require('../models/Author');
const Book = require('../models/Book');
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
// A missing counter (an author added outside the API) counts as 0: the first
// reserveBook creates the field, so a missing field means none was ever claimed.
async function deleteIfNoBooks(authorId) {
  const deleted = await Author.findOneAndDelete({ _id: authorId, bookCount: { $in: [0, null] } });
  return Boolean(deleted);
}

// Set every author's counter to the number of books that really point at them.
// The counter only sees books saved through the API, so it can drift: books
// added by a seed script or Compass, authors created before the counter
// existed, or a crash between reserving a place and saving the book.
// Runs at startup, before the server takes requests, so no create or delete
// is half-way through. Returns how many authors were corrected.
async function syncBookCounts() {
  const counts = await Book.aggregate([{ $group: { _id: '$author', count: { $sum: 1 } } }]);
  // Only authors whose counter is wrong are touched. timestamps: false, because
  // fixing an internal counter isn't an edit to the author, so updatedAt stays.
  const result = await Author.bulkWrite(
    [
      {
        updateMany: {
          filter: { _id: { $nin: counts.map((c) => c._id) }, bookCount: { $ne: 0 } },
          update: { $set: { bookCount: 0 } },
        },
      },
      ...counts.map(({ _id, count }) => ({
        updateOne: { filter: { _id, bookCount: { $ne: count } }, update: { $set: { bookCount: count } } },
      })),
    ],
    { timestamps: false }
  );
  return result.modifiedCount;
}

module.exports = { reserveBook, releaseBook, deleteIfNoBooks, syncBookCounts };
