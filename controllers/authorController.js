const Author = require('../models/Author');
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

module.exports = {
  createAuthor,
  getAuthors,
  getAuthor,
};
