const express = require('express');
const { createBook, getBooks, getBook } = require('../controllers/bookController');

const router = express.Router();

router.route('/').post(createBook).get(getBooks);
router.route('/:id').get(getBook);

module.exports = router;
