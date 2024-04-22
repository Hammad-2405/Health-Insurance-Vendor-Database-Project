const express = require("express");
const path = require('path'); 
const pool = require("./health_insurance_db.js");
const insuranceRouter = require('./routes/insurance.js');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('express-flash');
const app = express();
const { CLIENT_RENEG_LIMIT } = require("tls");
const currentDate = new Date();
app.set('view engine', 'ejs');

app.use('/images', express.static(path.join(__dirname, 'views', 'insurance', 'images')));

app.use(session({
    secret: 'your-secret-key', // Change this to a secure random key
    resave: false,
    saveUninitialized: true
  }));
app.use(flash());
app.use('/public', express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));

const adminPassword = '21k3181';

app.get('/', (req, res) => {
    res.render('insurance/login');
});

app.get('/login', (req,res) => {
    res.render('insurance/login.ejs');
})

app.get('/register', (req,res) => {
    res.render('insurance/register');
});

app.get('/admin', (req,res) => {
    res.render('insurance/admin.ejs');
});

app.get('/admin-view', (req,res) => {
    res.render('insurance/admin-view.ejs');
});

app.get('/dash', (req,res) => {
    res.render('insurance/dashboard.ejs');
})

app.get('/offers', (req,res) => {
    res.render('insurance/offers.ejs');
})

app.get('/delete-account', (req,res) => {
    res.render('insurance/delete-account.ejs')
})

app.get('/due-payment', (req, res) => {
    const userId = req.session.user.Username; 

    const sql = 'SELECT * FROM payments WHERE user_id = ?';
    pool.query(sql, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching due payments:', error);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('insurance/due-payment.ejs', { duePayments: results });
        }
    });
});


app.get('/schedule-visit', (req,res) => {
    res.render('insurance/visitinfo.ejs');
})

app.get('/nationalbuy', (req,res) => {
    res.render('insurance/nationalbuy.ejs');
})

app.get('/safeguardbuy', (req,res) => {
    res.render('insurance/safeguardbuy.ejs');
})

app.get('/ubibuy', (req,res) => {
    res.render('insurance/ubibuy.ejs');
})

app.post('/admin', (req, res) => {
    const enteredPassword = req.body.adminPassword;

    if (enteredPassword === adminPassword) {
        res.render('insurance/admin-view.ejs'); 
    } else {
        req.flash('error', 'Incorrect admin password. Please try again.');
        res.render('insurance/admin.ejs', { errorMessage: req.flash('error') });
    }
});

app.post('/admin/view-info', (req, res) => {
    const username = req.body.username;

    const userInfoQuery = 'SELECT * FROM users WHERE Username = ?';
    const paymentsInfoQuery = 'SELECT * FROM payments WHERE user_id = ?';

    pool.query(userInfoQuery, [username], (error, userResult) => {
        if (error) {
            return res.status(500).send('Internal Server Error');
        }

        const userInfo = userResult[0];

            pool.query(paymentsInfoQuery, [username], (error, paymentsResult) => {
                if (error) {
                    return res.status(500).send('Internal Server Error');
                }

                const paymentsInfo = paymentsResult[0]; 

                const combinedInfo = {
                    userInfo,
                    paymentsInfo
                };

                res.render('insurance/admin-view-info.ejs', { combinedInfo });
            });
        });
    });


app.post('/register', (req,res) => {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const username = req.body.username;
    const password = req.body.password;
    const contact = req.body.contact;
    const email = req.body.email;
    const address = req.body.address;

    const sql = `
    INSERT INTO users (First_Name, Last_Name, Username, Password, Contact, Email, Address)
    VALUES ('${firstName}', '${lastName}', '${username}', '${password}', '${contact}', '${email}', '${address}');
  `;
    
    pool.query(sql, (err, result) => {
    if (err) {
        console.error('Error inserting user data: ', err);
        res.status(500).send('Internal server error');
    } else {
        console.log('User data inserted successfully');
        res.render('insurance/login.ejs');
    }
});
});

app.post('/', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const sql = 'SELECT * FROM USERS WHERE Username=? AND Password=?';
    pool.query(sql,[username,password], (err,result) => {
        if(err) {
            console.error('Error executing query', err);
            res.status(500).send('Internal server error');
        };

        if(result.length>0){
            const user=result[0];
            req.session.user=user;
            res.render('insurance/dashboard.ejs');
        } else {
            req.flash('error', 'Invalid username or password');
            res.render('insurance/login.ejs', { errorMessage: req.flash('error') });
        }
    });
});

app.post('/delete-account', (req, res) => {
    try {
        const userId = req.session.user.Username; 

        const query = `
            DELETE users, payments
            FROM users
            LEFT JOIN payments ON users.Username = payments.user_id
            WHERE users.Username = ?;
        `;

        pool.query(query, [userId], (error, results) => {
            if (error) {
                console.error('Error deleting account:', error);
                res.status(500).send('Internal Server Error');
            } else {
                res.render('insurance/login.ejs');
            }
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/confirm-visit', (req, res) => {
    const userId = req.session.user.Username;
    const doctorId = req.body.doctorId;

    // Start a transaction
    pool.query('START TRANSACTION', (err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).send('Internal Server Error');
        }

        const sqlEarliestDate = 'SELECT MAX(visit_date) AS latest_date FROM visit WHERE doctor_id = ?';

        pool.query(sqlEarliestDate, [doctorId], (error, results) => {
            if (error) {
                return rollbackAndSendError(error, res);
            }

            const latestDate = results[0].latest_date;
            const nextAvailableDate = latestDate ? new Date(latestDate) : new Date();
            nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);

            const sqlInsert = 'INSERT INTO visit (user_id, doctor_id, visit_date, status) VALUES (?, ?, ?, ?)';
            pool.query(sqlInsert, [userId, doctorId, nextAvailableDate, 'active'], (error, results) => {
                if (error) {
                    return rollbackAndSendError(error, res);
                }

                // Update checkups column for the doctor
                const sqlUpdateCheckups = 'UPDATE doctors SET checkups = checkups + 1 WHERE doctor_id = ?';
                pool.query(sqlUpdateCheckups, [doctorId], (error) => {
                    if (error) {
                        return rollbackAndSendError(error, res);
                    }

                    // Commit the transaction
                    pool.query('COMMIT', (err) => {
                        if (err) {
                            return rollbackAndSendError(err, res);
                        }

                        res.render('insurance/visit-scheduled-success.ejs', { nextAvailableDate });
                    });
                });
            });
        });
    });
});

function rollbackAndSendError(error, res) {
    console.error('Error during transaction:', error);
    pool.query('ROLLBACK', (rollbackError) => {
        if (rollbackError) {
            console.error('Error rolling back transaction:', rollbackError);
        }
        res.status(500).send('Internal Server Error');
    });
}



app.post('/nationalbuy', (req, res) => {
    const credit_card = req.body.credit_card;
    const expiry = req.body.expiry;
    const cvv = req.body.cvv;
    const holdername = req.body.holdername;
    const user_id = req.session.user.Username;
    const user_contact = req.session.user.Contact;

    const Amount_Due = 400;
    const Due_Month = currentDate.getMonth() === 11 ? 1 : currentDate.getMonth() + 1;
    const Due_Year = currentDate.getMonth() === 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();

    const sql = `
    INSERT INTO payments (user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const sql2 = `
    INSERT INTO national_insurance (Username, Contact_Number)
    VALUES (?, ?);
    `;

    pool.query(sql, [user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry], (err, result) => {
        if (err) {
            console.error('Error storing payment details:', err);
            res.status(500).send('Internal Server Error');
        } else {
            // Continue with the second query
            pool.query(sql2, [user_id, user_contact], (err2, result2) => {
                if (err2) {
                    console.error('Error adding in insurance table:', err2);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.render('insurance/back_to_dash.ejs');
                }
            });
        }
    });
});

app.post('/safeguardbuy', (req, res) => {
    const credit_card = req.body.credit_card;
    const expiry = req.body.expiry;
    const cvv = req.body.cvv;
    const holdername = req.body.holdername;
    const user_id = req.session.user.Username;
    const user_contact = req.session.user.Contact;

    const Amount_Due = 4000;
    const dueDate = new Date(currentDate);
    dueDate.setFullYear(currentDate.getFullYear() + 1);

    const Due_Month = (dueDate.getMonth() + 1) % 12 || 12;
    const Due_Year = dueDate.getFullYear();


    const sql = `
    INSERT INTO payments (user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const sql2 = `
    INSERT INTO safeguard_insurance (Username, Contact_Number)
    VALUES (?, ?);
    `;

    pool.query(sql, [user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry], (err, result) => {
        if (err) {
            console.error('Error storing payment details:', err);
            res.status(500).send('Internal Server Error');
        } else {
            // Continue with the second query
            pool.query(sql2, [user_id, user_contact], (err2, result2) => {
                if (err2) {
                    console.error('Error adding in insurance table:', err2);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.render('insurance/back_to_dash.ejs');
                }
            });
        }
    });
});

app.post('/ubibuy', (req, res) => {
    const credit_card = req.body.credit_card;
    const expiry = req.body.expiry;
    const cvv = req.body.cvv;
    const holdername = req.body.holdername;
    const user_id = req.session.user.Username;
    const user_contact = req.session.user.Contact;

    const Amount_Due = 350;
    const Due_Month = currentDate.getMonth() === 11 ? 1 : currentDate.getMonth() + 1;
    const Due_Year = currentDate.getMonth() === 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();

    const sql = `
    INSERT INTO payments (user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const sql2 = `
    INSERT INTO ubi_insurance (Username, Contact_Number)
    VALUES (?, ?);
    `;

    pool.query(sql, [user_id, Amount_Due, Due_Month, Due_Year, credit_card, holdername, cvv, expiry], (err, result) => {
        if (err) {
            console.error('Error storing payment details:', err);
            res.status(500).send('Internal Server Error');
        } else {
            // Continue with the second query
            pool.query(sql2, [user_id, user_contact], (err2, result2) => {
                if (err2) {
                    console.error('Error adding in insurance table:', err2);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.render('insurance/back_to_dash.ejs');
                }
            });
        }
    });
});

app.get('/users',  (req, res) => {
    try {
        const [rows] =  pool.execute('CALL GetAllUsers()');

        // Send the results
        res.send(rows);
    } catch (error) {
        console.error('Error executing stored procedure', error);
        res.status(500).json({ error: 'Internal service error '});
    }
});

app.use('/insurance', insuranceRouter);

app.listen(3000, () => {
    console.log('listening on port 3000');
});
