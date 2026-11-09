const Book = require('../models/Book');
const findByIdOr404 = require('../utils/findByIdOr404');
const pick = require('../utils/pick');
const { validateBook } = require('../services/bookRules');

const BOOK_FIELDS = ['title', 'genre', 'price', 'publishedYear', 'author'];

// POST /books — nothing is saved unless every rule passes.
async function createBook(req, res) {
  const book = new Book(pick(req.body ?? {}, BOOK_FIELDS));
  await validateBook(book);
  await book.save();
  await book.populate('author');
  res.status(201).json(book);
}

// GET /books — each book includes its full author, not just the id.
async function getBooks(req, res) {
  const books = await Book.find().populate('author');
  res.json(books);
}

// GET /books/:id
async function getBook(req, res) {
  const book = await findByIdOr404(Book, req.params.id, 'book');
  await book.populate('author');
  res.json(book);
}

// PUT /books/:id — updates only the fields sent, then re-applies every rule
// to the merged book, because a change to one field can break a rule that
// involves another (e.g. moving a book to an author who already has that title).
async function updateBook(req, res) {
  const book = await findByIdOr404(Book, req.params.id, 'book');
  Object.assign(book, pick(req.body ?? {}, BOOK_FIELDS));
  await validateBook(book);
  await book.save();
  await book.populate('author');
  res.json(book);
}

// DELETE /books/:id
async function deleteBook(req, res) {
  const book = await findByIdOr404(Book, req.params.id, 'book');
  await book.deleteOne();
  res.json({ message: `Book "${book.title}" deleted` });
}

module.exports = { createBook, getBooks, getBook, updateBook, deleteBook };
