require('dotenv').config();
const session = require('express-session');
const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const mongoose = require('mongoose');
const MongoDBStore = require('connect-mongodb-session')(session);
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(express.json());

const port = process.env.PORT || 3000;

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const store = new MongoDBStore({
    uri: process.env.MONGODB_URI || `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.n7l0lf2.mongodb.net/test`,
    collection: 'sessions'
});

store.on('error', function (error) {
    console.log('Error with the MongoDB session store:', error);
});


mongoose.connect(process.env.MONGODB_URI || `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.n7l0lf2.mongodb.net/test`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,

}).then(() => {
    console.log('MongoDB connected successfully');
}).catch((err) => {
    console.log('Error connecting to MongoDB', err);
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

app.use(session({
    secret: node_session_secret,
    saveUninitialized: false,
    resave: true,
    store: store,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        res.send(`<h1>Hello, ${req.session.name}!</h1>
            <a href="/members">Members Area</a>
            <a href="/logout">Log out</a>`);
    } else {
        res.send(`<h1>Welcome, Please Log In or Sign Up!</h1>
            <a href="/signup">Sign Up</a>
            <br><br>
            <a href="/login">Log In</a>`);
    }
});

app.get('/signup', (req, res) => {
    res.send(`
        <h1>Sign Up</h1>
        <form method="POST" action="/signup">
            <label for="name">Name:</label>
            <input type="text" name="name" id="name" required>
            <br><br>
            <label for="email">Email:</label>
            <input type="email" name="email" id="email" required>
            <br><br>
            <label for="password">Password:</label>
            <input type="password" name="password" id="password" required>
            <br><br>
            <input type="submit" value="Sign Up">
        </form>
    `);
});

app.post('/signup', async (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        const message = error.details[0].message;
        return res.send(`<h1>Error</h1><p>${message}</p><a href="/signup">Try again</a>`);
    }

    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        });
        await user.save();
        req.session.loggedIn = true;
        req.session.name = req.body.name;
        res.redirect('/members');
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});

app.get('/login', (req, res) => {
    res.send(`<h1>Log In</h1> <form method="POST" action="/login"> <label for="email">Email:</label> <input type="email" name="email" id="email" required> <br><br> <label for="password">Password:</label> <input type="password" name="password" id="password" required> <br><br> <input type="submit" value="Log In"> </form>`);
});

app.post('/login', async (req, res) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    })
    const { error } = schema.validate(req.body);

    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.send(`<h1>Error</h1><p>User not found.</p><a href="/login">Try again</a>`);
        }
        const match = await bcrypt.compare(req.body.password, user.password);
        if (!match) {
            return res.send(`<h1>Error</h1><p>Invalid password.</p><a href="/login">Try again</a>`);
        }
        req.session.loggedIn = true;
        req.session.name = user.name;
        res.redirect('/members');
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});



app.get('/members', (req, res) => {
    if (!req.session.loggedIn) {
        return res.send(`<h1>Error</h1><p>You must be logged in to view this page.</p><a href="/login">Log In</a>`);
    } else {
        const images = ['image1.jpeg', 'image2.jpg', 'image3.jpeg'];
        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.send(`
                <h1>Members Area</h1>
                <p>Hello, ${req.session.name}!</p>
                <img src="/${randomImage}" alt="Random image"> 
                <br><br> 
                <a href="/logout">Log out</a> 
                <br> 
                <a href="/">Home</a>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/');
    
});

app.get('*', (req, res) => {
    res.status(404);
    res.send('<h1>404 Page Not Found</h1>');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});



