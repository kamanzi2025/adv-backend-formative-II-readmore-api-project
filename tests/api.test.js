// End-to-end tests against a throwaway in-memory MongoDB.
// Run with: npm test
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Author = require('../models/Author');
const Book = require('../models/Book');

let mongo;
const api = request(app);
const missingId = new mongoose.Types.ObjectId().toString();
const nextYear = new Date().getFullYear() + 1;

before(async () => {
  // Generous timeout: mongod can take a while to start on older machines.
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri());
  await mongoose.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Book.deleteMany({});
  await Author.deleteMany({});
});

async function createAuthor(fields = {}) {
  const res = await api.post('/authors').send({ name: 'Chinua Achebe', country: 'Nigeria', ...fields });
  assert.equal(res.status, 201);
  return res.body;
}

async function createBook(authorId, fields = {}) {
  const res = await api.post('/books').send({
    title: 'Things Fall Apart',
    genre: 'Fiction',
    price: 15,
    publishedYear: 1958,
    author: authorId,
    ...fields,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('GET / health check', async () => {
  const res = await api.get('/');
  assert.equal(res.status, 200);
  assert.ok(res.body.message);
});

describe('authors CRUD', () => {
  test('create, list, read, update, delete', async () => {
    const author = await createAuthor();

    const list = await api.get('/authors');
    assert.equal(list.body.length, 1);

    const one = await api.get(`/authors/${author._id}`);
    assert.equal(one.body.name, 'Chinua Achebe');

    const updated = await api.put(`/authors/${author._id}`).send({ bio: 'Novelist' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.bio, 'Novelist');
    assert.equal(updated.body.name, 'Chinua Achebe');

    const deleted = await api.delete(`/authors/${author._id}`);
    assert.equal(deleted.status, 200);
    assert.equal((await api.get(`/authors/${author._id}`)).status, 404);
  });

  test('missing name is 400', async () => {
    const res = await api.post('/authors').send({ country: 'Kenya' });
    assert.equal(res.status, 400);
  });

  test('unknown or malformed id is 404 on read, update and delete', async () => {
    for (const id of [missingId, 'not-an-id']) {
      assert.equal((await api.get(`/authors/${id}`)).status, 404);
      assert.equal((await api.put(`/authors/${id}`).send({ name: 'X' })).status, 404);
      assert.equal((await api.delete(`/authors/${id}`)).status, 404);
    }
  });
});

describe('books CRUD and linking', () => {
  test('reads populate the full author', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);

    const list = await api.get('/books');
    assert.equal(list.body.results[0].author.name, 'Chinua Achebe');

    const one = await api.get(`/books/${book._id}`);
    assert.equal(one.body.author.country, 'Nigeria');
  });

  test('update and delete a book', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);

    const updated = await api.put(`/books/${book._id}`).send({ price: 18.5 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.price, 18.5);
    assert.equal(updated.body.title, 'Things Fall Apart');

    assert.equal((await api.delete(`/books/${book._id}`)).status, 200);
    assert.equal((await api.get(`/books/${book._id}`)).status, 404);
  });

  test('unknown book id is 404', async () => {
    assert.equal((await api.get(`/books/${missingId}`)).status, 404);
    assert.equal((await api.put(`/books/${missingId}`).send({ price: 3 })).status, 404);
    assert.equal((await api.delete(`/books/${missingId}`)).status, 404);
  });

  test('GET /authors/:id/books returns only that author’s books', async () => {
    const achebe = await createAuthor();
    const adichie = await createAuthor({ name: 'Chimamanda Ngozi Adichie' });
    await createBook(achebe._id);
    await createBook(achebe._id, { title: 'Arrow of God' });
    await createBook(adichie._id, { title: 'Americanah' });

    const res = await api.get(`/authors/${achebe._id}/books`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((b) => b.title), ['Arrow of God', 'Things Fall Apart']);
    assert.equal((await api.get(`/authors/${missingId}/books`)).status, 404);
  });

  test('missing required field is 400', async () => {
    const author = await createAuthor();
    const res = await api.post('/books').send({ title: 'No price', genre: 'X', publishedYear: 2000, author: author._id });
    assert.equal(res.status, 400);
  });
});

describe('Requirement 1: no orphan books', () => {
  test('non-existent author id is 400 and nothing is saved', async () => {
    const res = await api.post('/books').send({ title: 'Ghost', genre: 'X', price: 5, publishedYear: 2000, author: missingId });
    assert.equal(res.status, 400);
    assert.equal(await Book.countDocuments(), 0);
  });

  test('malformed author id is 400', async () => {
    const res = await api.post('/books').send({ title: 'Ghost', genre: 'X', price: 5, publishedYear: 2000, author: '123' });
    assert.equal(res.status, 400);
  });

  test('moving a book to a non-existent author is 400', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);
    const res = await api.put(`/books/${book._id}`).send({ author: missingId });
    assert.equal(res.status, 400);
  });
});

describe('Requirement 2: no duplicate titles per author', () => {
  test('same title, different case, same author is 409', async () => {
    const author = await createAuthor();
    await createBook(author._id, { title: 'The Silent Sea' });
    const res = await api.post('/books').send({ title: 'the silent sea', genre: 'X', price: 5, publishedYear: 2000, author: author._id });
    assert.equal(res.status, 409);
  });

  test('same title for a different author is allowed', async () => {
    const a = await createAuthor();
    const b = await createAuthor({ name: 'Someone Else' });
    await createBook(a._id, { title: 'Home' });
    await createBook(b._id, { title: 'Home' });
  });

  test('renaming into a duplicate is 409, changing only the case of its own title is fine', async () => {
    const author = await createAuthor();
    await createBook(author._id, { title: 'Arrow of God' });
    const book = await createBook(author._id);

    assert.equal((await api.put(`/books/${book._id}`).send({ title: 'ARROW OF GOD' })).status, 409);
    assert.equal((await api.put(`/books/${book._id}`).send({ title: 'things fall apart' })).status, 200);
  });

  test('moving a book to an author who already has that title is 409', async () => {
    const a = await createAuthor();
    const b = await createAuthor({ name: 'Someone Else' });
    await createBook(a._id, { title: 'Home' });
    const bBook = await createBook(b._id, { title: 'Home' });
    assert.equal((await api.put(`/books/${bBook._id}`).send({ author: a._id })).status, 409);
  });
});

describe('Requirement 3: price and year rules', () => {
  const cases = [
    { price: 0 },
    { price: -4 },
    { publishedYear: nextYear },
    { publishedYear: 1449 },
    { publishedYear: 2001.5 },
  ];
  for (const fields of cases) {
    test(`${JSON.stringify(fields)} is 422`, async () => {
      const author = await createAuthor();
      const res = await api.post('/books').send({ title: 'T', genre: 'X', price: 5, publishedYear: 2000, author: author._id, ...fields });
      assert.equal(res.status, 422);
      assert.match(res.body.message, /price|publishedYear/);
    });
  }

  test('boundary values 1450 and the current year are accepted', async () => {
    const author = await createAuthor();
    await createBook(author._id, { title: 'Old', publishedYear: 1450 });
    await createBook(author._id, { title: 'New', publishedYear: nextYear - 1, price: 0.01 });
  });

  test('rules also apply on update', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);
    assert.equal((await api.put(`/books/${book._id}`).send({ price: 0 })).status, 422);
  });
});

describe('Requirement 4: delete policy (block)', () => {
  test('author with books cannot be deleted (409), books untouched', async () => {
    const author = await createAuthor();
    await createBook(author._id);
    const res = await api.delete(`/authors/${author._id}`);
    assert.equal(res.status, 409);
    assert.equal(await Author.countDocuments(), 1);
    assert.equal(await Book.countDocuments(), 1);
  });

  test('author can be deleted once their books are gone', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);
    await api.delete(`/books/${book._id}`);
    assert.equal((await api.delete(`/authors/${author._id}`)).status, 200);
  });
});

describe('Requirement 5: search and filter', () => {
  let achebe;
  beforeEach(async () => {
    achebe = await createAuthor();
    const other = await createAuthor({ name: 'Other' });
    await createBook(achebe._id, { title: 'The Silent Sea', genre: 'Thriller', price: 24.99, publishedYear: 2021 });
    await createBook(achebe._id, { title: 'Sea of Glass', genre: 'Thriller', price: 9, publishedYear: 2015 });
    await createBook(achebe._id, { title: 'Arrow of God', genre: 'Fiction', price: 20, publishedYear: 1964 });
    await createBook(other._id, { title: 'Deep Sea', genre: 'Thriller', price: 30, publishedYear: 2019 });
  });

  const titles = (res) => res.body.results.map((b) => b.title);

  test('no params returns everything', async () => {
    const res = await api.get('/books');
    assert.equal(res.body.total, 4);
    assert.equal(res.body.results.length, 4);
  });

  test('the README example: genre + price range + search + sort', async () => {
    const res = await api.get('/books?genre=Thriller&minPrice=10&maxPrice=30&search=sea&sort=price&order=asc');
    assert.deepEqual(titles(res), ['The Silent Sea', 'Deep Sea']);
  });

  test('only minPrice', async () => {
    const res = await api.get('/books?minPrice=21');
    assert.deepEqual(titles(res).sort(), ['Deep Sea', 'The Silent Sea']);
  });

  test('genre is case-insensitive, author filter works', async () => {
    const res = await api.get(`/books?genre=thriller&author=${achebe._id}&sort=title`);
    assert.deepEqual(titles(res), ['Sea of Glass', 'The Silent Sea']);
  });

  test('sort by publishedYear descending', async () => {
    const res = await api.get('/books?sort=publishedYear&order=desc');
    assert.deepEqual(res.body.results.map((b) => b.publishedYear), [2021, 2019, 2015, 1964]);
  });

  test('search treats regex characters literally', async () => {
    const res = await api.get('/books?search=.*');
    assert.equal(res.body.total, 0);
  });

  test('bad params are 400', async () => {
    for (const qs of ['minPrice=abc', 'minPrice=30&maxPrice=10', 'sort=author', 'order=up', 'author=xyz', 'page=0', 'limit=500']) {
      assert.equal((await api.get(`/books?${qs}`)).status, 400, qs);
    }
  });

  test('pagination returns page, limit, total and results', async () => {
    const res = await api.get('/books?sort=price&page=2&limit=3');
    assert.equal(res.body.page, 2);
    assert.equal(res.body.limit, 3);
    assert.equal(res.body.total, 4);
    assert.equal(res.body.totalPages, 2);
    assert.deepEqual(titles(res), ['Deep Sea']);
  });
});

describe('Requirement 6: author stats', () => {
  test('summary of an author’s books', async () => {
    const author = await createAuthor();
    await createBook(author._id, { title: 'Things Fall Apart', price: 15 });
    await createBook(author._id, { title: 'No Longer at Ease', price: 18 });
    await createBook(author._id, { title: 'Arrow of God', price: 20 });
    await createBook(author._id, { title: 'Anthills of the Savannah', price: 33 });

    const res = await api.get(`/authors/${author._id}/stats`);
    assert.deepEqual(res.body, {
      author: 'Chinua Achebe',
      bookCount: 4,
      averagePrice: 21.5,
      cheapestBook: 'Things Fall Apart',
      mostExpensiveBook: 'Anthills of the Savannah',
    });
  });

  test('author with no books gets zero count and nulls', async () => {
    const author = await createAuthor();
    const res = await api.get(`/authors/${author._id}/stats`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      author: 'Chinua Achebe',
      bookCount: 0,
      averagePrice: null,
      cheapestBook: null,
      mostExpensiveBook: null,
    });
  });

  test('unknown author is 404', async () => {
    assert.equal((await api.get(`/authors/${missingId}/stats`)).status, 404);
  });
});

describe('concurrency: no orphans even when requests race', () => {
  test('deleting an author while a book is created for them never leaves an orphan', async () => {
    for (let i = 0; i < 20; i++) {
      const author = await createAuthor({ name: `Racer ${i}` });
      const [del, create] = await Promise.all([
        api.delete(`/authors/${author._id}`),
        api.post('/books').send({ title: 'Race', genre: 'X', price: 5, publishedYear: 2000, author: author._id }),
      ]);
      // Exactly one side wins: the delete (book refused) or the book (delete refused).
      assert.ok(
        (del.status === 200 && create.status === 400) || (del.status === 409 && create.status === 201),
        `delete ${del.status}, create ${create.status}`
      );
      const authorGone = !(await Author.exists({ _id: author._id }));
      const bookSaved = Boolean(await Book.exists({ author: author._id }));
      assert.ok(!(authorGone && bookSaved), 'orphan book left behind');
    }
  });

  test('deleting the same book twice at once succeeds once, and the author can still be deleted after', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id);
    const results = await Promise.all([api.delete(`/books/${book._id}`), api.delete(`/books/${book._id}`)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 404]);
    assert.equal((await api.delete(`/authors/${author._id}`)).status, 200);
  });

  test('moving a book updates which author can be deleted', async () => {
    const a = await createAuthor();
    const b = await createAuthor({ name: 'Someone Else' });
    const book = await createBook(a._id);
    assert.equal((await api.put(`/books/${book._id}`).send({ author: b._id })).status, 200);
    assert.equal((await api.delete(`/authors/${a._id}`)).status, 200);
    assert.equal((await api.delete(`/authors/${b._id}`)).status, 409);
  });

  test('failed saves give their place back, so the counter always matches the real books', async () => {
    const author = await createAuthor();
    // Identical creates at once: some pass the duplicate check, reserve a place,
    // then lose to the unique index. Plus outright rejected requests.
    const results = await Promise.all(Array.from({ length: 8 }, () => createBookRaw(author._id, 'Same Time')));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    await createBookRaw(author._id, 'same time'); // 409
    await api.post('/books').send({ title: 'Bad', genre: 'X', price: 0, publishedYear: 2000, author: author._id }); // 422

    const counted = (await Author.findById(author._id).select('+bookCount')).bookCount;
    assert.equal(counted, await Book.countDocuments({ author: author._id }));

    const [book] = (await api.get(`/authors/${author._id}/books`)).body;
    await api.delete(`/books/${book._id}`);
    assert.equal((await api.delete(`/authors/${author._id}`)).status, 200);
  });

  test('the internal book counter is never exposed', async () => {
    const author = await createAuthor();
    await createBook(author._id);
    assert.equal((await api.get(`/authors/${author._id}`)).body.bookCount, undefined);
    assert.equal((await api.get('/books')).body.results[0].author.bookCount, undefined);
  });
});

function createBookRaw(authorId, title) {
  return api.post('/books').send({ title, genre: 'X', price: 5, publishedYear: 2000, author: authorId });
}

describe('input edge cases', () => {
  test('titles differing only in inner spacing are duplicates, and are stored tidied', async () => {
    const author = await createAuthor();
    const book = await createBook(author._id, { title: '  Things   Fall  Apart ' });
    assert.equal(book.title, 'Things Fall Apart');
    assert.equal((await createBookRaw(author._id, 'things fall apart')).status, 409);
  });

  test('boolean, array or object prices and years are 400', async () => {
    const author = await createAuthor();
    for (const fields of [{ price: true }, { price: [15] }, { publishedYear: false }, { publishedYear: { $gt: 0 } }]) {
      const res = await api.post('/books').send({ title: 'T', genre: 'X', price: 5, publishedYear: 2000, author: author._id, ...fields });
      assert.equal(res.status, 400, JSON.stringify(fields));
    }
  });

  test('numeric strings are still accepted', async () => {
    const author = await createAuthor();
    await createBook(author._id, { price: '15.5', publishedYear: '1958' });
  });
});

describe('startup index check', () => {
  test('existing duplicate titles give a clear error instead of a bare crash', async () => {
    const { ensureIndexes } = require('../config/db');
    const authorId = new mongoose.Types.ObjectId();
    await Book.collection.dropIndexes();
    await Book.collection.insertMany([
      { title: 'Home', author: authorId },
      { title: 'home', author: authorId },
    ]);
    await assert.rejects(ensureIndexes(), /already contains the same title twice/);
    await Book.deleteMany({});
    await ensureIndexes();
  });
});

test('invalid JSON body is 400', async () => {
  const res = await api.post('/authors').set('Content-Type', 'application/json').send('{bad');
  assert.equal(res.status, 400);
});
