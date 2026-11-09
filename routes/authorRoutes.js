const express = require('express');
const {
  createAuthor,
  getAuthors,
  getAuthor,
  updateAuthor,
  getAuthorBooks,
} = require('../controllers/authorController');

const router = express.Router();

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthor).put(updateAuthor);
router.get('/:id/books', getAuthorBooks);

module.exports = router;
