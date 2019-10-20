const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Static Files
app.use(express.static('public'));

// Parser
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

// View Engine
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('book-details.ejs')
})

app.listen(3000, () => {
    console.log('Listening on 3000')
})
