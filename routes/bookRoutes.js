const express = require('express');
const { createBook, getBooks, getBook, updateBook, deleteBook } = require('../controllers/bookController');

const router = express.Router();

router.route('/').post(createBook).get(getBooks);
router.route('/:id').get(getBook).put(updateBook).delete(deleteBook);

module.exports = router;
