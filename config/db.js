const mongoose = require('mongoose');
const Book = require('../models/Book');

async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and add your connection string.');
  }
  await mongoose.connect(uri);
  // Build the per-author unique title index before taking traffic.
  await Book.createIndexes();
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
}

module.exports = connectDB;
