const { getProducts } = require('../Controllers/ProductController');
const ensureAuthenticated = require('../Middlewares/AuthMiddleware');

const router = require('express').Router();

router.get('/', ensureAuthenticated, getProducts);

module.exports = router;