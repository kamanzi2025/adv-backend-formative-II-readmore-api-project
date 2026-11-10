const mongoose = require('mongoose');
const Book = require('../models/Book');

async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and add your connection string.');
  }
  await mongoose.connect(uri);
  await ensureIndexes();
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
}

// Build the per-author unique title index before taking traffic.
// createIndexes only adds missing indexes; it never drops existing ones.
async function ensureIndexes() {
  try {
    await Book.createIndexes();
  } catch (err) {
    if (err.code === 11000) {
      throw new Error(
        'The books collection already contains the same title twice for one author ' +
          '(ignoring case and extra spaces), so the no-duplicates rule cannot be enforced. ' +
          `Remove or rename the duplicate before starting. Details: ${err.message}`
      );
    }
    throw err;
  }
}

module.exports = connectDB;
module.exports.ensureIndexes = ensureIndexes;
