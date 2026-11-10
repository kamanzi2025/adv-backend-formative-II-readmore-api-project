const mongoose = require('mongoose');

// Case-insensitive comparison (strength 2 ignores case but not accents).
// Shared with the controller so the duplicate-title check and the index agree.
const TITLE_COLLATION = { locale: 'en', strength: 2 };

// Trim and collapse runs of spaces, so "Things  Fall Apart" and
// "Things Fall Apart" are stored, and compared, as the same title.
function normaliseTitle(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'title is required'], set: normaliseTitle },
    genre: { type: String, required: [true, 'genre is required'], trim: true },
    price: { type: Number, required: [true, 'price is required'] },
    publishedYear: { type: Number, required: [true, 'publishedYear is required'] },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author',
      required: [true, 'author is required'],
    },
  },
  // optimisticConcurrency: saving a book that another request changed since it
  // was loaded fails instead of silently overwriting that change.
  { timestamps: true, optimisticConcurrency: true }
);

// Backstop for the "no duplicate titles per author" rule: the controller checks
// first so it can answer with a clear 409, and this index catches two requests
// racing each other past that check.
bookSchema.index({ author: 1, title: 1 }, { unique: true, collation: TITLE_COLLATION });

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
module.exports.TITLE_COLLATION = TITLE_COLLATION;
