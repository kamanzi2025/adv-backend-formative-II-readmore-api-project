const express = require('express');
const {
  createAuthor,
  getAuthors,
  getAuthor,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
} = require('../controllers/authorController');

const router = express.Router();

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthor).put(updateAuthor).delete(deleteAuthor);
router.get('/:id/books', getAuthorBooks);

module.exports = router;
