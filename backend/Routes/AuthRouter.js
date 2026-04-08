const { signup } = require('../controllers/AuthController');
const signupValidation = require('../Middlewares/AuthValidation');

const router = require('express').Router();  


router.post('/login', loginValidation, login);  
router.post('/signup', signupValidation, signup);  

module.exports = router;