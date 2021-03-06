require('dotenv').config();

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const favicon = require('serve-favicon');
const hbs = require('hbs');
const mongoose = require('mongoose');
const logger = require('morgan');
const path = require('path');

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const Prediction = require("./models/Prediction")
const User = require("./models/User")
const apiCoinMarket = require("./public/javascripts/apiCoinMarket")
const moment = require("moment")



mongoose
    .connect(process.env.DBURL, { useNewUrlParser: true })
    .then(x => {
        console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`)
    })
    .catch(err => {
        console.error('Error connecting to mongo', err)
    });

setInterval(() => {

    Prediction.find({})
        .then(predictions => {
            predictions.forEach(prediction => {
                if ((moment(prediction.endDate).format("MMM Do YY") === moment(new Date()).format("MMM Do YY") || prediction.endDate < new Date() ) && prediction.status === "live") {
                    apiCoinMarket.getCoinPrice(prediction.cryptocurrency)
                        .then(coin => {
                            // console.log(prediction.price)
                            // console.log(coin.data[prediction.cryptocurrency].quote.USD.price)
                            if ((prediction.price / coin.data[prediction.cryptocurrency].quote.USD.price) <= 1 && (prediction.price / coin.data[prediction.cryptocurrency].quote.USD.price) >= 0.9) {
                                User.findOneAndUpdate({ _id: prediction.user }, { $inc: { puntuation: 1 } })
                                    .then(() => {
                                        console.log(prediction._id)
                                        return Prediction.findOneAndUpdate({ _id: prediction._id }, { $set: { status: "dead" } })
                                    })
                            } else {
                                console.log("You uck")
                                return Prediction.findOneAndUpdate({ _id: prediction._id }, { $set: { status: "dead" } })
                            }
                        })
                } else {
                    console.log("No data to check")
                }
            })
        })
        .catch(err => console.log(err))

}, 1000000)

const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);

const app = express();

// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Express View engine setup

app.use(require('node-sass-middleware')({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    sourceMap: true
}));

// Middleware gestión de sesión
app.use(session({
    secret: 'personal secret',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 },
    store: new MongoStore({
        mongooseConnection: mongoose.connection,
        ttl: 24 * 60 * 60 // 1 day
    })
}));


app.use((req, res, next) => {

    if (req.session.currentUser) {
        res.locals.currentUserInfo = req.session.currentUser;
        res.locals.isUserLoggedIn = true;
    } else {
        res.locals.isUserLoggedIn = false;
    }
    next();
});


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

hbs.registerPartials(__dirname + '/views/partials')



// default value for title local
app.locals.title = 'Express - Generated with IronGenerator';
app.use((req, res, next) => {
    app.locals.user = req.session.currentUser;
    next();
})


const index = require('./routes/index');
app.use('/', index);

const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

const predictions = require('./routes/predictions');
app.use('/', predictions);

module.exports = app;