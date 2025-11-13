const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB URI using .env variables
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}.c5kbqln.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    await client.db('admin').command({ ping: 1 });
    console.log('🌿 Successfully connected to MongoDB!');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('🌿 EcoTrack Server is running');
});

// Start server
app.listen(port, () => {
  console.log(`🌿 EcoTrack Server running on port ${port}`);
});
