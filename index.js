require('dotenv').config();
const session = require('express-session');
const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const mongoose = require('mongoose');
const MongoDBStore = require('connect-mongodb-session')(session);
const app = express();

app.set('view engine', 'ejs');

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
    password: { type: String, required: true },
    user_type: { type: String, default: 'user', enum: ['user', 'admin'] }
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
        res.render('loggedInHome.ejs', { name: req.session.name });
    } else {
        res.render('home.ejs');
    }
});

app.get('/signup', (req, res) => {
    res.render("signUp");
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
    res.render("logIn");
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
        req.session.user_type = user.user_type;
        res.redirect('/members');
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});



app.get('/members', (req, res) => {
    if (!req.session.loggedIn) {
        return res.render('notLoggedIn.ejs');
    } else {
        res.render("members", {name: req.session.name});
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/');
    
});

// method that checks if an user type is admin
function isAdmin(req) {
    if (req.session.user_type == 'admin') {
        return true;
    }
    return false;
}

// middleware function
function adminAuthorization(req, res, next) {
    if (!isAdmin(req)) {
        res.status(403);
        res.render("errorMessage", {error: "Not Authorized"});
        return;
    }
    else {
        next();
    }
}

app.get('/admin', async (req, res) => {
    const result = await User.find().select('username user_type _id');
    if (!req.session.loggedIn ) {
        return res.render('notLoggedIn.ejs');
    }

    if(req.session.user_type != 'admin'){
        return res.render('errorMessage');

    }

    try {
        const users = await User.find({});
        res.render('admin.ejs', { users: users });
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});

app.get('/promote/:userId', async (req, res) => {
    try {
        await User.updateOne({ _id: req.params.userId }, { $set: { user_type: 'admin' } });
        res.redirect('/admin');
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});

app.get('/demote/:userId', async (req, res) => {
    try {
        await User.updateOne({ _id: req.params.userId }, { $set: { user_type: 'user' } });
        res.redirect('/admin');
    } catch (err) {
        console.log(err);
        res.send('<h1>Error</h1><p>Sorry, an error occurred while processing your request.</p>');
    }
});


app.get('*', (req, res) => {
    res.status(404);
    res.render('404Page');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});



