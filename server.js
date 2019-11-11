const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mongoose = require('mongoose');

//Define a schema
let Schema = mongoose.Schema;

let BookSchema = new Schema({
    bookId: { type: String, required: true, unique: true },
    ISBN: { type: String, required: true, unique: true },
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

let DBUserSchema = new Schema({
    password: { type: String, required: true }
})
const DBUser = mongoose.model('DBUser', DBUserSchema)

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
    Book.find({ bookId: req.params.uid.toLowerCase() }).limit(1).then((data) => {
        if (data.length > 0) {
            if (data[0].reviews.length > 0) {
                let averageRating = 0;
                data[0].reviews.forEach((item) => {
                    averageRating += item.numberRating;
                })
                averageRating /= data[0].reviews.length
                data[0].averageRating = averageRating.toFixed(2).toString().replace('.', ',');
                data[0].averageRatingInteger = averageRating.toFixed(1);
            } else {
                data[0].averageRating = 0;
                data[0].averageRatingInteger = 0;
            }
            // Render the page
            // res.send(data[0])
            res.render('book-details.ejs', { book: data[0] })
        } else {
            // Render 404 Page
            res.send(data)
        }
    });
});

app.get('/backend/login', (req, res) => {
    let error = req.query.error
    res.render('backend-login.ejs', { error: error });
})

app.post('/login', (req, res) => {
    let password = req.body.password;
    DBUser.find({ password: password }).limit(1).then((data) => {
        if (data.length > 0) {
            res.send(data)
        } else {
            res.redirect('/backend/login?error=true')
        }
    })
})

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

app.get('/backend/newBook/init', (req, res) => {
    Book.remove((err, data) => {
        if (err) return console.log(err);
        let initialBook = new Book({
            bookId: 'factfulness',
            ISBN: '1473637465',
            title: `Factfulness: Ten Reasons We're Wrong About the World – and Why Things Are Better Than You Think`,
            genres: 'Nonfiction, Science',
            authors: 'Hans Rosling, Ola Rosling, Anna Rosling Rönnlund',
            description: `<i>Factfulness</i>: The stress-reducing habit of only carrying opinions for which you have strong supporting facts.<br><br>When asked simple questions about global trends—<i>what percentage of the world’s population live in poverty; why the world’s population is increasing; how many girls finish school</i>—we systematically get the answers wrong. In Factfulness, Professor of International Health and global TED phenomenon Hans Rosling, together with his two long-time collaborators, Anna and Ola, offers <b>a radical new explanation of why this happens</b>. They reveal <b>the ten instincts that distort our perspective</b>—from our tendency to divide the world into two camps (usually some version of us and them) to the way we consume media (where fear rules) to how we perceive progress (believing that most things are getting worse).<br><br>Our problem is that we don’t know what we don’t know, and even our guesses are informed by unconscious and predictable biases.<br><br><b>It turns out that the world, for all its imperfections, is in a much better state than we might think</b>. That doesn’t mean there aren’t real concerns. But when we worry about everything all the time instead of embracing a worldview based on facts, we can lose our ability to focus on the things that threaten us most.`,
            pageCount: 342,
            language: 'English',
            datePublished: 'January 25th 2018',
            bookMediaLink: 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1544963815l/34890015._SY475_.jpg',
            reviews: [
                {
                    userName: 'Max',
                    numberRating: 4,
                    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.'
                }
            ]
        });
        initialBook.save((err, data) => {
            if (err) return console.log(err);
            res.redirect(`/book/factfulness`);
        });
    })
})

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
            console.log(data._id);
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
