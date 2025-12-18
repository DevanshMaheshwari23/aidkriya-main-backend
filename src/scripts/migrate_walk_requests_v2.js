const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WalkRequest = require('../models/WalkRequest');

dotenv.config();

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const cursor = WalkRequest.find({}).cursor();
  let migrated = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const update = {};

    if (!doc.mobilityLevel) {
      const pace = doc.pace;
      if (pace === 'Slow') {
        update.mobilityLevel = 'LIGHT_SUPPORT';
      } else if (pace === 'Moderate' || pace === 'Fast' || pace === 'Very Fast') {
        update.mobilityLevel = 'INDEPENDENT';
      }
    }

    if (!doc.primaryPurpose) {
      const conv = doc.conversationLevel;
      if (conv === 'Silent' || conv === 'Light') {
        update.primaryPurpose = 'FRESH_AIR_LEISURE';
      } else if (conv === 'Moderate' || conv === 'Chatty') {
        update.primaryPurpose = 'SOCIAL_COMPANION';
      }
    }

    if (!doc.communicationNeeds) {
      const langs = Array.isArray(doc.languages) ? doc.languages : [];
      update.communicationNeeds = {
        languages: langs.length > 0 ? langs : ['English'],
        hearingImpaired: false,
        speechDifficulty: false,
        prefersNonVerbal: false,
        requiresClearCommunication: false,
        additionalNotes: undefined
      };
    }

    if (Object.keys(update).length > 0) {
      await WalkRequest.updateOne({ _id: doc._id }, { $set: update, $unset: { pace: '', conversationLevel: '', languages: '' } });
      migrated += 1;
    }
  }

  console.log(`Migrated ${migrated} walk requests`);
  await mongoose.connection.close();
}

migrate().catch(async (e) => {
  console.error(e);
  await mongoose.connection.close();
  process.exit(1);
});

