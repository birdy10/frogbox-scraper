const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files from current directory
app.use(express.static(__dirname));

// Create endpoint to fetch CSV data
app.get('/getMatches', async (req, res) => {
    try {
        const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYkRzvjRAVkEkxAjyEfgOSRi4QsyV-fMObIoKfLnbP8Bpjth9_i4o3AeOH3S7Pl8Qji33ydik-xxtL/pub?gid=1341734975&single=true&output=csv';
        const response = await fetch(url);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
