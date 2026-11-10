const Author = require('../models/Author');
const Book = require('../models/Book');
const HttpError = require('../utils/HttpError');
const findByIdOr404 = require('../utils/findByIdOr404');
const pick = require('../utils/pick');
const { deleteIfNoBooks } = require('../services/authorBookCount');

const AUTHOR_FIELDS = ['name', 'country', 'bio'];

// POST /authors
async function createAuthor(req, res) {
  const author = await Author.create(pick(req.body ?? {}, AUTHOR_FIELDS));
  res.status(201).json(author);
}

// GET /authors
async function getAuthors(req, res) {
  const authors = await Author.find().sort({ name: 1 });
  res.json(authors);
}

// GET /authors/:id
async function getAuthor(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');
  res.json(author);
}

// PUT /authors/:id — updates only the fields sent; save() re-runs schema validation.
async function updateAuthor(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');
  Object.assign(author, pick(req.body ?? {}, AUTHOR_FIELDS));
  await author.save();
  res.json(author);
}

// DELETE /authors/:id
// Requirement 4, policy A (block): an author who still has books can't be
// deleted. Their books are store inventory and may already have been sold,
// so we never destroy or silently re-attribute them as a side effect.
// The books must be deleted or moved to another author (PUT /books/:id) first.
// Two checks, both must pass:
// 1. The books themselves: any saved book blocks the delete, whatever the
//    counter says (a book may have been added outside the API).
// 2. The counter, checked and deleted in one atomic step, so a book being
//    created at this same moment can't slip in between and become an orphan.
async function deleteAuthor(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');

  const savedBooks = await Book.countDocuments({ author: author._id });
  if (savedBooks > 0) throw hasBooksError(author, savedBooks);

  if (!(await deleteIfNoBooks(author._id))) {
    // Another request may have deleted the author in the meantime.
    if (!(await Author.exists({ _id: author._id }))) {
      throw new HttpError(404, `No author found with id ${req.params.id}`);
    }
    const booksNow = await Book.countDocuments({ author: author._id });
    if (booksNow > 0) throw hasBooksError(author, booksNow);
    // No saved books, but a create has already reserved a place for one.
    throw new HttpError(409, `Cannot delete ${author.name}: a book for them is being saved right now. Try again shortly.`);
  }

  res.json({ message: `Author ${author.name} deleted` });
}

function hasBooksError(author, count) {
  return new HttpError(
    409,
    `Cannot delete ${author.name}: they still have ${count} book(s). ` +
      'Delete those books or move them to another author first.'
  );
}

// GET /authors/:id/books
async function getAuthorBooks(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');
  const books = await Book.find({ author: author._id }).collation(Book.TITLE_COLLATION).sort({ title: 1 });
  res.json(books);
}

// GET /authors/:id/stats — Requirement 6.
async function getAuthorStats(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');

  // Sorted by price, so the first book in the group is the cheapest and the
  // last is the most expensive. Title breaks ties so the answer is repeatable.
  const [summary] = await Book.aggregate([
    { $match: { author: author._id } },
    { $sort: { price: 1, title: 1 } },
    {
      $group: {
        _id: null,
        bookCount: { $sum: 1 },
        averagePrice: { $avg: '$price' },
        cheapestBook: { $first: '$title' },
        mostExpensiveBook: { $last: '$title' },
      },
    },
  ]);

  // No books: the count is a real 0, but there is no average, cheapest or most
  // expensive book, so those are null rather than a misleading price of 0.
  res.json({
    author: author.name,
    bookCount: summary ? summary.bookCount : 0,
    averagePrice: summary ? Math.round(summary.averagePrice * 100) / 100 : null,
    cheapestBook: summary ? summary.cheapestBook : null,
    mostExpensiveBook: summary ? summary.mostExpensiveBook : null,
  });
}

module.exports = {
  createAuthor,
  getAuthors,
  getAuthor,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
  getAuthorStats,
};
