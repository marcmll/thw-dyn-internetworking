// Node Modules
const express = require('express'); // Express.js
const session = require('express-session'); // Sessions
const bodyParser = require('body-parser'); // Body Parser
const ObjTree = require('xml-objtree'); // XML to JSON Converter
const xhr = require('xhr-request'); // XHR Request package
const cookieParser = require('cookie-parser');  // Cookie Parser package
const mongoose = require('mongoose'); // MongoDB (Mongoose) package

/* ///////////////////
// Mongo DB Schemas //
/////////////////// */
const Schema = mongoose.Schema; // Init Mongoose Schemas
const schemas = require('./schemas.js'); // Import Schemas Objects from schemas.js
const Book = mongoose.model('Book', new Schema(schemas.book)); // Book Schema
const Review = mongoose.model('Review', new Schema(schemas.review)); // Review Schema
const DBUser = mongoose.model('DBUser', new Schema(schemas.dbuser)); // DBUser Schema

/* ///////////////////
// Main App: Routes //
/////////////////// */
const app = express(); // Initialize Express.js

// Static Files: Show server where they are located
app.use(express.static('public'));

// Initialize Sessions
app.use(session({secret: 'sessionsecret', saveUninitialized: true, resave: true}));

// Initialize Cookies
app.use(cookieParser());

// Initialize body parser
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// Set view engine: EJS (EJS is a simple templating language that lets you generate HTML markup with plain JavaScript)
app.set('view engine', 'ejs');

// GET Index Page (Home)
app.get('/', (req, res) => {
    // DB Request: find all books with editorPick set to true, and limit the results to 4.
    Book.find({ editorPick: true }).limit(4).then((editorPicks) => {
        // DB Request: find all books, sort by the reviewCount from most to least and limit the results to 3.
        Book.find().sort([['reviewCount', -1]]).limit(3).then((popularBooks) => {
            // DB Request: find all books, sort by the dateSubmitted from most recent to longest ago and limit the results to 7.
            Book.find().sort([['dateSubmitted', -1]]).limit(7).then((recentData) => {
                // Render the index.ejs view with the results from each of the DB Requests.
                res.render('index.ejs', { editorPicks: editorPicks, popularBooks: popularBooks, recentlyAdded: recentData });
            });
        });
    });
});


// GET Book Detail Page
app.get('/book/:uid', (req, res) => {
    // DB Request: find the book with the bookId matching the uid parameter in the URL
    Book.find({ bookId: req.params.uid.toLowerCase() }).then((data) => {
        if (data.length > 0) {
            // If a book with the uid is found, save the data returned from the DB in the variable bookData
            const bookData = data[0]

            // Find out if the user has already written a review for this book
            let userReviews = (req.cookies.userReviews || '').split(',');
            let reviewQuery = { bookId: bookData._id };
            if (userReviews.includes(bookData._id.toString())) {
                // If the user has reviewed the book, adjust the reviewQuery to exlude the review belonging to the user
                reviewQuery = { bookId: bookData._id, _id: { $ne: userReviews[(userReviews.indexOf(bookData._id.toString()) + 1)] } };
            }

            // DB Request: find all reviews with the bookId matching the _id for the book found and sort them from most recent to longest ago.
            Review.find(reviewQuery).sort([['dateSubmitted', -1]]).then((reviewData) => {
                // When all reviews have been found, check if the user has written a review, based on the query inserted above
                if (reviewQuery._id !== undefined) {
                    // If the user has written a review: DB Request: find the review with the corresponding _id
                    Review.find({ _id: reviewQuery._id.$ne }).then((userReviewData) => {
                        // When the user review has been found, render the book-details.ejs view with the bookData, userReviewData and reviewData recieved from the DB.
                        res.render('book-details.ejs', { book: bookData, userReview: userReviewData[0], reviews: reviewData })
                    })
                } else {
                    // If the user has yet to write a review for this book, render the book-details.ejs view with the bookData and reviewData recieved from the DB.
                    res.render('book-details.ejs', { book: bookData, reviews: reviewData })
                }
            })
        } else {
            // If no book with the uid is found, render the 404.ejs view with a custom 404 message.
            res.render('404.ejs', { errorTitle: 'Book not Found', errorMsg: 'This URL does not return a book in our database. Check the URL, search or visit the <a href="/">homepage</a>.' })
        }
    });
});


// POST: Review Upload Request
app.post('/uploadReview', (req, res) => {
    const currentDate = new Date;

    // Make new JS Object following the review scheme getting the data from the inputs in the submitted form.
    const newReview = {
        bookId: req.body.bookObjectId,
        userName: req.body.userName,
        numberRating: parseInt(req.body.numberRating),
        description: req.body.description,
        dateLongFormat: `${currentDate.getDate()} ${matchFullMonth((currentDate.getMonth() + 1))} ${currentDate.getFullYear()}`,
        dateShortFormat: `${currentDate.getDate()}/${(currentDate.getMonth() + 1)}/${String(currentDate.getFullYear()).substr(2,2)}`
    };

    // DB Request: save a new review with the data in the newReview object defined above
    (new Review(newReview)).save(newReview).then((reviewData) => {
        //  When review is successfully saved, update the Cookie so that the user cannot write a second review for the same book
        let userReviews = req.cookies.userReviews || '';
        if (userReviews == undefined || userReviews == '' || userReviews.length == 0) { // In case Cookie 'userReviews' doesn't exist yet, initialize it with the Review _id
            userReviews = `${reviewData.bookId},${reviewData._id}`;
        } else {
            userReviews += `,${reviewData.bookId},${reviewData._id}`;
        }
        res.cookie('userReviews', userReviews); // overwrite Cookie 'userReviews'

        // Once Cookie is updated, redirect to the updateBookReviewCount route, passing along the bookId and bookObjectId from the hidden input fields
        res.redirect(`/updateBookReviewCount/${req.body.bookId}/${req.body.bookObjectId}`);
    });
});


// GET: Update Book Review Count / Average Rating
app.get('/updateBookReviewCount/:bookId/:bookObjectId', (req, res) => {
    // DB Request: find all reviews with the bookId equal to the bookObjectId in the parameters of the request URL
    Review.find({ bookId: req.params.bookObjectId }).then((reviewData) => {
        let ratingSum = 0
        // For each of the reviews found, add the number rating to the sum of all reviews
        reviewData.forEach((item, idnex) => {
            ratingSum += item.numberRating
        });

        // DB Request: update the book with the _id equal to the bookObjectId: set the reviewCount to the amount of reviews found and set the average rating to the sum of all review ratings and the amount of reviews found (average)
        Book.findOneAndUpdate({ _id: req.params.bookObjectId.toLowerCase() }, { reviewCount: reviewData.length, averageRating: (ratingSum / reviewData.length) }).then(() => {
            // When the book is successfully updated, redirect to the book detail page
            res.redirect(`/book/${req.params.bookId}`);
        });
    });
});


// POST Search
app.post('/dbSearch', (req, res) => {
    const searchQuery = req.body.searchQuery.toString();
    // DB Request: find the book with the isbn set to the search field input
    Book.find({ isbn: searchQuery }).then((isbnData, err) => {
        if (err) return res.send(err)
        if (isbnData.length > 0) {
            // If a book with this isbn in found, redirect to the books detail page
            res.redirect(`/book/${isbnData[0].bookId}`);
        } else {
            // If no book with this isbn is found: DB Request: find all books that have a title including the search query (not case sensitive)
            Book.find({ title: { $regex: searchQuery, $options: 'i' } }).then((textMatchData, error) => {
                // Render the search.ejs view, passing along the search query and the book data for all of the books found.
                res.render('search.ejs', { query: searchQuery, searchResults: textMatchData });
            });
        }
    });
});


// GET Backend Redirect (Logged in: Dashboard // else: Login)
app.get('/backend', (req, res) => {
    const currentSession = req.session
    // If session is found with loggedIn as true, redirect to the dashboard page
    if (currentSession.loggedIn) {
        res.redirect('/backend/dashboard')
    } else {
        // If loggedIn is set to false, or no session is found, redirect to the login page
        res.redirect('/backend/login')
    }
});


// GET Backend Login Page
app.get('/backend/login', (req, res) => {
    const error = req.query.error
    const currentSession = req.session
    // If sessions is found with loggedIn as true, redirect to the dashboard page
    if (currentSession.loggedIn) {
        res.redirect('/backend/dashboard')
    } else {
        // If loggedIn is set to false, or no session is found, render the backend-login.ejs view and send the error query if found.
        res.render('backend-login.ejs', { error: error });
    }
});


// POST Login Request
app.post('/login', (req, res) => {
    const password = req.body.password;
    // DB Request: find the DB User with the password entered in the password input and limit the users found to 1
    DBUser.find({ password: password }).limit(1).then((data) => {
        if (data.length > 0) {
            // If DB User with the password is found, set the loggedIn session to true and redirect to the dashboard
            const currentSession = req.session
            currentSession.loggedIn = true
            res.redirect('/backend/dashboard')
        } else {
            // If no DB User is found, redirect to the login page with error set to true
            res.redirect('/backend/login?error=true')
        }
    });
});


// POST Logout Request
app.get('/backend/logout', (req, res) => {
    // Destroy the session, automatically settings loggedIn to false, then redirect to the login page
    req.session.destroy((err) => {
        if(err) return console.log(err);
        res.redirect('/backend/login');
    });
});


// GET Backend Dashboard
app.get('/backend/dashboard', (req, res) => {
    const currentSession = req.session
    const filterOptions = [
        // Filter sorting results by the date submitted from most recent to longest ago
        {
            id: 0,
            name: 'Date Submitted Desc.',
            filter: ['dateSubmitted', -1]
        },
        // Filter sorting results by the date submitted from longest ago to most recent
        {
            id: 1,
            name: 'Date Submitted Asc.',
            filter: ['dateSubmitted', 1]
        },
        // Filter sorting results by the title from A to Z
        {
            id: 2,
            name: 'Title Asc.',
            filter: ['title', 1]
        },
        // Filter sorting results by the title from Z to A
        {
            id: 3,
            name: 'Title Desc.',
            filter: ['title', -1]
        },
        // Filter sorting results by the page count from least to most
        {
            id: 4,
            name: 'Page Count Asc.',
            filter: ['pageCount', 1]
        },
        // Filter sorting results by the page count from most to least
        {
            id: 5,
            name: 'Page Count Desc.',
            filter: ['pageCount', -1]
        }
    ]
    // Get the selected filter based on the ?nextFilter query. If no query is found, set the selected filter to 0
    const selectedFilter = (req.query.nextFilter !== undefined && req.query.nextFilter !== '') ? (parseInt(req.query.nextFilter) === filterOptions.length ? 0 : req.query.nextFilter) : 0
    // Get the search query based on the ?search query. If no query is found, set the searchQuery to an empty object
    const searchQuery = req.query.search ? { title: { $regex: req.query.search.toString(), $options: 'i' } } : {}
    if (currentSession.loggedIn) {
        // If loggedIn is true, make DB Request finding all books with the selected search query and sort by the selected filter
        Book.find(searchQuery).sort([filterOptions[selectedFilter].filter]).then((data) => {
            // Render the backend-dashboard.ejs view with the books found, the selected filter and the search query if found.
            if (searchQuery.title !== undefined) {
                res.render('backend-dashboard.ejs', { books: data, currentFilter: filterOptions[selectedFilter], search: req.query.search.toString() });
            } else {
                res.render('backend-dashboard.ejs', { books: data, currentFilter: filterOptions[selectedFilter]});
            }
        });
    } else {
        // If loggedIn is false or there is no session, redirect to the login page
        res.redirect('/backend/login')
    }
});


// GET Backend New Book Form
app.get('/backend/editBook', (req, res) => {
    // Render the new-book-form.ejs view with an empty object named "book"
    res.render('new-book-form.ejs', { book: {} });
});


// POST Backend Book Form
app.post('/backend/editBook', (req, res) => {
    // DB Request: find the book with the bookID set to the bookId in the hidden input field, limit this to 1.
    Book.find({ bookId: req.body.bookId.toLowerCase() }).limit(1).then((data) => {
        if (data.length > 0) {
            // If a book is found, render the new-book-form.ejs view with the book data found.
            res.render('new-book-form.ejs', { book: data[0] });
        } else {
            // If no book is found, redirect to the empty new book form.
            res.redirect('/backend/editBook')
        }
    });
});


// POST Book Upload Request
app.post('/uploadBook', (req, res) => {
    // Sort genres into an array by splitting by comma
    let genres = req.body.genres.split(',');
    genres.forEach((item, index) => {
        genres[index] = item.trim();
    });

    // Sort authors into an array by splitting by comma
    let authors = req.body.authors.split(',');
    authors.forEach((item, index) => {
        authors[index] = item.trim();
    });

    // Create a new object following to the Book Schema, taking values from the input fields in the submitted form.
    const newBook = {
        bookId: req.body.bookId.trim(),
        title: req.body.title.trim(),
        genres: genres,
        authors: authors,
        description: req.body.description.trim(),
        pageCount: req.body.pageCount.trim(),
        language: req.body.language.trim(),
        datePublished: req.body.datePublished.trim(),
        isbn: req.body.isbn.trim(),
        bookMediaLink: req.body.bookMediaLink.trim()
    }

    // DB Request: find the books with the bookId equal to the bookId in the form input field.
    Book.find({ bookId: newBook.bookId }).then((readData) => {
        if (readData.length > 0) {
            // If a book with the bookId exists: DB Request: Update the book with the bookId
            Book.findOneAndUpdate(
                { bookId: req.body.bookId },
                newBook
            ).then((data) => {
                // When all data is updated, redirect to the book detail page
                res.redirect(`/book/${req.body.bookId}`);
            }).catch((err) => {
                // Render the new-book-form.ejs view, passing in the data entered and the error message
                res.render('new-book-form.ejs', { book: newBook, errorData: [err.errmsg] });
            })
        } else {
            // If no book with the bookId can be found, DB Request: save new book with the newBook Object data
            (new Book(newBook)).save(newBook).then(() => {
                // When book has been successfully saved, redirect to the book detail page.
                res.redirect(`/book/${req.body.bookId}`);
            }).catch((err) => {
                const errorData = []
                // If error occurs during the saving process, push custom error message to an errorData array.
                if (err.keyPattern.isbn !== undefined) {
                    errorData.push('A book with this ISBN already exists in the database');
                } else {
                    errorData.push(err.errmsg)
                }

                // Render the new-book-form.ejs view, passing in the data entered and the error message
                res.render('new-book-form.ejs', { book: newBook, errorData: errorData });
            });
        }
    });
});


// POST Request: Remove Book
app.post('/backend/deleteBook', (req, res) => {
    // DB Request: delete all reviews with the bookId set to the bookId from the hidden input field.
    Review.deleteMany({ bookId: req.body.bookId }).then(() => {
        // DB Request: delete the book with the _id set to the bookId from the hidden input field.
        Book.findOneAndDelete({ _id: req.body.bookId }).then(() => {
            // When all reviews and the book are deleted, redirect to the dashboard
            res.redirect('./dashboard');
        });
    });
});


// POST Request: Toggle Editor Pick State
app.post('/backend/toggleEditorPick', (req, res) => {
    const newState = req.body.editorPick == 'true' ? false : true;
    // DB Request: update the editorPick boolean for the book with the _id equivilent to the bookId from the hidden input field.
    Book.findOneAndUpdate({ _id: req.body.bookId.toLowerCase() }, { editorPick: newState }).then(() => {
        // When the editorPick boolean has been updated for the selected book, redirect to the dashboard
        res.redirect('./dashboard');
    });
});


// POST Request: Backend Search
app.post('/backend/search', (req, res) => {
    const searchQuery = req.body.searchQuery.toString();
    // redirect to the dashboard with the search query as a URL query
    res.redirect(`/backend/dashboard?search=${searchQuery}`);
});


// GET Request: API Search Form
app.get('/backend/apiSearch', (req, res) => {
    const currentSession = req.session
    // If session is found with loggedIn as true, render the backend-api-results.ejs view with an empty object named "books"
    if (currentSession.loggedIn) {
        res.render('backend-api-results.ejs', { books: {} })
    } else {
        // If loggedIn is set to false, or no session is found, redirect to the login page
        res.redirect('/backend/login')
    }
});


// POST Request: API Search Request
app.post('/backend/apiSearch', (req, res) => {
    const searchQuery = req.body.searchQuery.split(' ').join('+');
    // XHR Request: /search goodreads API endpoint with the search query and the api key
    xhr(`https://www.goodreads.com/search?q=${searchQuery}&key=tdA5Yy8qQvgKYHwdzm5Xg`, {}, (err, data) => {
        // If err is returned, throw err
        if (err) throw err
        const bookData = []
        const objTree = new ObjTree();
        // If data is returned, convert it into JSON using the objTree npm package.
        data = objTree.parseXML(data);
        if (data.GoodreadsResponse.search.results.work != undefined) {
            // If list of books is found for the search query, iterate through them and fill bookData array with objects including the most relevant information from each book
            data.GoodreadsResponse.search.results.work.forEach((item, index) => {
                bookData[index] = {
                    bookId: item.best_book.id['#text'],
                    bookMediaLink: item.best_book.image_url,
                    title: item.best_book.title,
                    author: item.best_book.author.name
                }
            })
        }
        // Once iterating through all the results, render the backend-api-results.ejs view, passing in the book data for all books found and the search query
        res.render('backend-api-results.ejs', { books: bookData, search: req.body.searchQuery })
    });
});


// Function for matching the suffix of the day number: 1 -> 1st, 22 -> 22nd, 28 -> 28th, etc.
const matchDaySuffix = (day) => {
    if (day) {
        day = day.toString()
        const secondToLastNum = parseInt(day.substring(day.length - 2, day.length - 1))
        const lastNum = parseInt(day.substring(day.length - 1, day.length))
        if (secondToLastNum != 1) {
            switch (lastNum) {
                case 1:
                    return `${day}st`
                case 2:
                    return `${day}nd`
                case 3:
                    return `${day}rd`
                default:
                    return `${day}th`
            }
        } else {
            return `${day}th`
        }
    } else {
        return ''
    }
}


// Function for matching the months number to its string form: 1 -> January, 12 -> December, etc.
const matchFullMonth = (month) => {
    const monthList = [
        'January',
        'Febuary',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ]
    return monthList[(month - 1)]
}


// Function matching language code from the goodreads api to a full string: ger -> German, eng -> English.
const matchLanguageCode = (langCode) => {
    switch (langCode) {
        case 'ger':
            return 'German'
        default:
            return 'English'
    }
}


// Function for capitalizing the first letter of a string: history -> History
const capitalize = (s) => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
}


// Function for matching the genres from the goodreads api to string genres: science-fiction -> Science Fiction
const getGenres = (apiGenres) => {
    const genreList = ['biography', 'crime', 'fantasy', 'fiction', 'history', 'horror', 'mystery', 'nonfiction', 'romance', 'science', 'science-fiction']
    const genres = []
    // Iterate through all genres found by the goodreads api
    for (let i = 0; i < apiGenres.length; i++) {
        const genrePosition = genreList.indexOf(apiGenres[i]['-name'])
        if (genrePosition > -1) {
            // If genre is found in the predetermined list, push the matching genre to the genres array
            genres.push(capitalize(genreList[genrePosition].split('-').join(' ')))
        }
        if (genres.length >= 2) {
            // Once 2 genres have been matched, return the list and stop iterating.
            return genres
        }
    }
    return genres
}


// POST Request: API Form Fill: Request Book Details from goodreads API and fill them into book form
app.post('/backend/apiFormFill', (req, res) => {
    const goodreadsBookId = req.body.bookId;
    // XHR Request: /book/show/ API endpoint with the bookid from the API /search results and the API key
    xhr(`https://www.goodreads.com/book/show/${goodreadsBookId}.xml?key=tdA5Yy8qQvgKYHwdzm5Xg`, {}, (err, data) => {
        // Catch errors
        if (err) throw err

        // Initialize objectTree for converting XML to JSON
        const objTree = new ObjTree();

        // Set data variable to the parsed JSON Object
        data = (objTree.parseXML(data)).GoodreadsResponse.book;

        // Get Author List from API result
        let authors = []
        if (data.authors.author.name !== undefined) {
            authors.push(data.authors.author.name)
        } else {
            for (const author of data.authors.author) {
                authors.push(author.name)
            }
        }

        // Get Genres using the getGenres function
        const genres = getGenres(data.popular_shelves.shelf)

        // Get date published and format it
        const rawDate = [data.work.original_publication_day['#text'], data.work.original_publication_month['#text'], data.work.original_publication_year['#text']];
        const formatedDate = `${matchDaySuffix(rawDate[0])} ${matchFullMonth(rawDate[1])} ${rawDate[2]}`;

        // Get the image link from the API result and format it to recieve the highest quality image
        const formatedImageLink = data.small_image_url.substr(0, (data.small_image_url.lastIndexOf('/') + 1)) + data.id + '._SY475_.jpg';
        
        // Create a new object following to the Book Schema, taking values from the API results
        const bookData = {
            bookId: data.title.replace(/[^A-Za-z0-9\s]/g,'').toLowerCase().split(' ').join('-'),
            title: data.title,
            genres: genres,
            authors: authors,
            description: data.description,
            pageCount: data.num_pages,
            language: matchLanguageCode(data.language_code),
            datePublished: formatedDate,
            isbn: data.isbn,
            bookMediaLink: formatedImageLink
        }
        
        // When all data is recieved and formated, render the new-book-form.ejs view, passing in the formated book data
        res.render('new-book-form.ejs', { book: bookData });
    });
});


// GET Request: 404 (All Routes not found before this point)
app.get('*', (req, res) => {
    // Render the 404.ejs view, passing in a custom error message
    res.render('404.ejs', { errorTitle: 'URL not Found', errorMsg: 'This URL does not seem to exist. Check the URL, search or visit the <a href="/">homepage</a>.' })
});


// MongoDB Connection
mongoose.connect('mongodb://betterreads_admin:betterreads-pwd-2019@localhost:27017/betterreads', {
    // Options to avoid deprecation
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
}, (err) => {
    // Catch connection error
    if (err) return console.log(err)

    // Confirm DB Connection
    console.log('Connected');

    // Start Listening for Routes
    app.listen(3000, () => {
        console.log('Listening on 3000')
    });
});
