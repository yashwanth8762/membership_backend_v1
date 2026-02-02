const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");
const cron = require('node-cron');
const fs = require("fs");




cron.schedule('01 01 * * *', () => {
    const empty_these_directories = [
        "assets/temp_resources",
        "assets/images",
        "assets/documents",
        // "assets/dis_reports",
    ]
    
    empty_these_directories.map((directory) => {
        fs.readdir(directory, (err, files) => {
            if (err) throw err;
    
            for (const file of files) {
                fs.unlink(path.join(directory, file), (err) => {
                    if (err) throw err;
                });
            }
        });
    });
});

app.use(cors());

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(morgan("dev"));
app.use(express.json({ limit: '2048mb' }));
app.use(express.urlencoded({ extended: true, limit: '2048mb' }));


const API_ROOT ='/' 
app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, "assets")));
app.disable('etag');


const userRoutes = require("./routes/User");
const membershipRoutes = require('./routes/Membership');
const mediaTypeRoutes = require('./routes/mediaType');
const mediaRoutes = require('./routes/media');
const activityRoutes = require('./routes/Activity');
const programRoutes = require('./routes/UpcommingPrograms');
const galleryRoutes = require('./routes/Gallary');
const districtRoutes = require('./routes/district');
const talukRoutes = require('./routes/taluk');
const donationRoutes = require('./routes/Donation')





app.use(`${API_ROOT}membership`, membershipRoutes);
app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}media-type`, mediaTypeRoutes)
app.use(`${API_ROOT}media`, mediaRoutes)
app.use(`${API_ROOT}activity`, activityRoutes);
app.use(`${API_ROOT}upcommingprograms`, programRoutes);
app.use(`${API_ROOT}gallery`, galleryRoutes);
app.use(`${API_ROOT}district`, districtRoutes);
app.use(`${API_ROOT}taluk`, talukRoutes);
app.use(`${API_ROOT}donation`, donationRoutes)





app.get('/', (req, res) => {
    res.send('Hello from Node.js backend!');
  });
  
  
  
  // Database connection
  try {
      const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/Membership";
      const DB_PORT = process.env.PORT || PORT;
  
      mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
          .then(async () => {
              console.log("DB Connection Successful");
              try {
                // Sync indexes for membership_submission to ensure sparse unique index on membershipId
                const { MembershipSubmission } = require('./Modals/Membership');
                const collection = mongoose.connection.collection('membership_submissions');
                try {
                  const existing = await collection.indexes();
                  for (const idx of existing) {
                    if (idx.key && idx.key.membershipId === 1) {
                      await collection.dropIndex(idx.name);
                      console.log(`Dropped existing membershipId index ${idx.name}`);
                    }
                  }
                } catch (e) {
                  console.warn('Unable to inspect/drop indexes for membership_submissions:', e?.message || e);
                }

                // Create the correct partial unique index explicitly
                try {
                  await collection.createIndex(
                    { membershipId: 1 },
                    { unique: true, name: 'membershipId_unique_partial', partialFilterExpression: { membershipId: { $type: 'string' } } }
                  );
                  console.log('Ensured partial unique index on membershipId');
                } catch (e) {
                  console.warn('Error ensuring partial unique index on membershipId:', e?.message || e);
                }

                // Also run Mongoose sync as a safety net
                await MembershipSubmission.syncIndexes();
                console.log('Indexes synced for MembershipSubmission');
              } catch (idxErr) {
                console.warn('Failed to sync indexes for MembershipSubmission:', idxErr?.message || idxErr);
              }
              app.listen(DB_PORT, () => {
                  console.log(`Server is running on port ${DB_PORT}`);
              });
          })
          .catch(err => {
              console.log("Error in connecting to DB:", err);
          });
  } catch (error) {
      console.log("Error in connecting to DB:", error);
  }
  