const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'name is required'], trim: true },
    country: { type: String, trim: true },
    bio: { type: String, trim: true },
    // Internal counter of the books that point at this author, changed only with
    // atomic $inc. Creating a book and deleting an author each test-and-change
    // this one field in a single operation, so two requests arriving together
    // can't leave an orphan book (see services/authorBookCount.js).
    // Hidden from queries and responses: the API reports counts from the books.
    bookCount: { type: Number, default: 0, min: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.bookCount;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Author', authorSchema);
