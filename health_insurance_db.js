const mysql = require("mysql2");

const dotenv = require('dotenv');
dotenv.config()

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
})

pool.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
});

pool.getConnection((err,connection) => {
    if(err){
        console.error("Error connecting to database: ",err);
        return;
    }
    console.log("Connected to database");
    connection.release();
});

module.exports = pool;