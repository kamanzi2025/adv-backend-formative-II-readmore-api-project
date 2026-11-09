const Book = require('../models/Book');
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

module.exports = { createBook };
