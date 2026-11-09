const express = require('express');
const {
  createAuthor,
  getAuthors,
  getAuthor,
} = require('../controllers/authorController');

const router = express.Router();

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthor);

module.exports = router;
