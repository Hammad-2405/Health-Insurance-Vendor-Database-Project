const mysql = require('mysql2');

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: 'hammad',
  database: 'health_insurance',
};

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
  connection.end(); // Close the database connection
});
