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
    const db = client.db(process.env.DB_NAME);

    // Collections
    const challengeCollection = db.collection('challenges');
    const userChallengesCollection = db.collection('UserChallenges');
    const eventsCollection = db.collection('upcomingEvents');
    const participantsCollection = db.collection('eventParticipants');
    const tipsCollection = db.collection('all-tips');

    // ------------------ CHALLENGES ROUTES ------------------ //
    app.get('/challenges', async (req, res) => {
      try {
        const challenges = await challengeCollection.find({}).toArray();
        res.status(200).json(challenges);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch challenges' });
      }
    });

    app.get('/challenges/:id', async (req, res) => {
      try {
        const challenge = await challengeCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!challenge)
          return res.status(404).json({ message: 'Challenge not found' });
        res.status(200).json(challenge);
      } catch (error) {
        res.status(400).json({ message: 'Invalid challenge ID' });
      }
    });

    app.post('/challenges', async (req, res) => {
      try {
        const newChallenge = req.body;
        if (!newChallenge.createdBy)
          return res
            .status(400)
            .json({ message: 'createdBy field is required' });

        newChallenge.participants = newChallenge.participants || 0;
        const result = await challengeCollection.insertOne(newChallenge);
        res
          .status(201)
          .json({ message: 'Challenge added', challengeId: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create challenge' });
      }
    });

    app.put('/challenges/:id', async (req, res) => {
      try {
        const updateData = req.body;
        const result = await challengeCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        );
        if (result.matchedCount === 0)
          return res.status(404).json({ message: 'Challenge not found' });
        res.status(200).json({ message: 'Challenge updated' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update challenge' });
      }
    });

    app.delete('/challenges/:id', async (req, res) => {
      try {
        const result = await challengeCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        if (result.deletedCount === 0)
          return res.status(404).json({ message: 'Challenge not found' });
        res.status(200).json({ message: 'Challenge deleted' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete challenge' });
      }
    });

    // ------------------ USER CHALLENGES ------------------ //
    app.get('/user-challenges/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const userChallenges = await userChallengesCollection
          .find({ userId })
          .toArray();

        const challengeIds = userChallenges
          .map(uc => {
            try {
              return uc.challengeId instanceof ObjectId
                ? uc.challengeId
                : new ObjectId(uc.challengeId);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const challenges = await challengeCollection
          .find({ _id: { $in: challengeIds } })
          .toArray();

        const merged = userChallenges.map(uc => {
          let challengeObj = null;
          try {
            const cid =
              uc.challengeId instanceof ObjectId
                ? uc.challengeId
                : new ObjectId(uc.challengeId);
            challengeObj = challenges.find(c => c._id.equals(cid)) || null;
          } catch {}
          return { ...uc, challenge: challengeObj };
        });

        res.status(200).json(merged);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch user challenges' });
      }
    });

    app.post('/user-challenges', async (req, res) => {
      try {
        const { userId, challengeId } = req.body;
        const objectChallengeId = new ObjectId(challengeId);

        const exists = await userChallengesCollection.findOne({
          userId,
          challengeId: objectChallengeId,
        });
        if (exists) return res.status(400).json({ message: 'Already joined' });

        const newUserChallenge = {
          userId,
          challengeId: objectChallengeId,
          status: 'Not Started',
          progress: 0,
          joinDate: new Date(),
        };
        await userChallengesCollection.insertOne(newUserChallenge);

        await challengeCollection.updateOne(
          { _id: objectChallengeId },
          { $inc: { participants: 1 } }
        );

        res
          .status(201)
          .json({ message: 'Joined challenge', data: newUserChallenge });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to join challenge' });
      }
    });

    app.delete('/user-challenges/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const userChallenge = await userChallengesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!userChallenge)
          return res.status(404).json({ message: 'User challenge not found' });

        const challengeId = userChallenge.challengeId;

        await userChallengesCollection.deleteOne({ _id: new ObjectId(id) });
        await challengeCollection.updateOne(
          { _id: new ObjectId(challengeId) },
          { $inc: { participants: -1 } }
        );

        res.status(200).json({ message: 'Left challenge successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to leave challenge' });
      }
    });

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
