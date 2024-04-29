const express = require('express');
const session = require('express-session');
const mongoSessionStore = require('connect-mongo');
const next = require('next');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');

const setupGoogle = require('./google');
const { setupGithub } = require('./github');
const api = require('./api');

// const { insertTemplates } = require('./models/EmailTemplate');
const routesWithSlug = require('./routesWithSlug');
const { stripeCheckoutCallback } = require('./stripe');

require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const MONGO_URL = process.env.MONGO_URL_TEST;

const port = process.env.PORT || 8000;
const ROOT_URL = `http://localhost:${port}`;

mongoose.connect(MONGO_URL);

const URL_MAP = {
  '/login': '/public/login',
  '/my-books': '/customer/my-books',
};

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = express();

  server.use(helmet({ contentSecurityPolicy: false }));
  server.use(compression());

  server.use(express.json());

  const sessionOptions = {
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    store: mongoSessionStore.create({
      mongoUrl: MONGO_URL,
      ttl: 14 * 24 * 60 * 60, // save session 14 days
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 14 * 24 * 60 * 60 * 1000, // expires in 14 days
      domain: 'localhost',
    },
  };

  const sessionMiddleware = session(sessionOptions);
  server.use(sessionMiddleware);

  // await insertTemplates();

  setupGoogle({ server, ROOT_URL });
  setupGithub({ server, ROOT_URL });
  api(server);
  routesWithSlug({ server, app });

  stripeCheckoutCallback({ server });

  server.get('*', (req, res) => {
    const url = URL_MAP[req.path];
    if (url) {
      app.render(req, res, url);
    } else {
      handle(req, res);
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on ${ROOT_URL}`);
  });
});
