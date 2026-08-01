require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

require('./db'); // initializes the database + seeds the default admin on first run

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/targets', require('./routes/targets'));
app.use('/api/users', require('./routes/users'));

// Serve the built frontend
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// Anything that isn't an API route falls through to the frontend (client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`QI dashboard server running on port ${PORT}`);
});
