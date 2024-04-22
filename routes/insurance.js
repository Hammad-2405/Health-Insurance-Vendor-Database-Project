const express = require('express')
const router = express.Router()

router.get('/insurance', (req,res) => {
    res.render('insurance/login' )
})

/*router.get('/Offer.html', (req,res) => {
    res.render('insurance/Offer')
})*/

/*router.get('/dashboard.ejs', (req,res) => {
    res.render('insurance/dashboard')
})*/

module.exports = router