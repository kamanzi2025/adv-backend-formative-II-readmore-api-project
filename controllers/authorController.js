const Author = require('../models/Author');
const Book = require('../models/Book');
const HttpError = require('../utils/HttpError');
const findByIdOr404 = require('../utils/findByIdOr404');
const pick = require('../utils/pick');

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
async function deleteAuthor(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');

  const bookCount = await Book.countDocuments({ author: author._id });
  if (bookCount > 0) {
    throw new HttpError(
      409,
      `Cannot delete ${author.name}: they still have ${bookCount} book(s). ` +
        'Delete those books or move them to another author first.'
    );
  }

  await author.deleteOne();
  res.json({ message: `Author ${author.name} deleted` });
}

// GET /authors/:id/books
async function getAuthorBooks(req, res) {
  const author = await findByIdOr404(Author, req.params.id, 'author');
  const books = await Book.find({ author: author._id }).sort({ title: 1 });
  res.json(books);
}

module.exports = {
  createAuthor,
  getAuthors,
  getAuthor,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
};
