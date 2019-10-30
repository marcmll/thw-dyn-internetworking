const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mongoose = require("mongoose");

//Define a schema
var Schema = mongoose.Schema;

var BookSchema = new Schema({
    bookId: { type: String, required: true },
    ISBN: { type: String, required: true },
    title: { type: String, required: true },
    genres: [String],
    authors: [String],
    description: { type: String, required: true },
    pageCount: { type: Number, required: true },
    language: { type: String, required: true },
    datePublished: { type: String, required: true },
    bookMediaLink: { type: String, required: true },
    dateSubmitted: { type: Date, default: Date.now, required: true },
    reviews: [{
        userName: { type: String, required: true },
        numberRating: { type: Number, min: 1, max: 5, required: true },
        description: { type: String, required: true },
        dateSubmitted: { type: Date, default: Date.now, required: true }
    }]
});
const Book = mongoose.model('Book', BookSchema);

// Static Files
app.use(express.static('public'));

// Parser
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// View Engine
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    Book.find().then((data) => {
        res.send(data)
    });
});

app.get('/book/:uid', (req, res) => {
    Book.find({ bookId: req.params.uid }).limit(1).then((data) => {
        if (data.length > 0) {
            // res.send(data)
            res.render('book-details.ejs', { book: data[0] })
        } else {
            // Render 404 Page
            res.send(data)
        }
    });
});

app.get('/backend/newBook', (req, res) => {
    res.render('new-book-form.ejs');
})

app.post('/uploadBook', (req, res) => {
    console.log(req.body)
    let genres = req.body.genres.split(',');
    genres.forEach((item, index) => {
        genres[index] = item.trim();
    });
    let authors = req.body.authors.split(',');
    authors.forEach((item, index) => {
        authors[index] = item.trim();
    });
    const newBook = new Book({
        bookId: req.body.bookId,
        ISBN: req.body.isbn,
        title: req.body.title,
        genres: genres,
        authors: authors,
        description: req.body.description,
        pageCount: req.body.pageCount,
        language: req.body.language,
        datePublished: req.body.datePublished,
        bookMediaLink: req.body.bookMediaLink
    });
    // res.send(newBook);
    newBook.save((err, data) => {
        if (err) {
            return console.log('Error:' + err);
        } else {
            console.log(data);
            res.redirect(`/book/${req.body.bookId}`);
        }
    });
});

app.post('/uploadReview', (req, res) => {
    console.log(req.body)
    const newReview = {
        userName: req.body.userName,
        numberRating: parseInt(req.body.numberRating),
        description: req.body.description
    }
    Book.findOneAndUpdate(
        { bookId: req.body.bookId },
        { $push: {reviews: newReview }},
        (err, data) => {
            if (err) return console.log (err)
            console.log(data);
            res.redirect(`/book/${req.body.bookId}`);
        }
    );
});

mongoose.connect('mongodb://betterreads_admin:betterreads-pwd-2019@localhost:27017/betterreads', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
}, (err) => {
    if (err) return console.log(err)
    console.log('Connected');
});

app.listen(3000, () => {
    console.log('listening on 3000')
});
