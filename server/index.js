// server/index.js
const express = require('express');
const cors = require('cors'); // Import cors
const app = express();
const port = 3001; // Frontend will run on 3000

app.use(cors()); // Use cors middleware

app.get('/', (req, res) => {
    res.send('Hello from the backend!');
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});
