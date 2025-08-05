const express = require('express');
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
        "assets/district_issues",
        "assets/department_issues",
        "assets/district_reports",
        "assets/dis_reports",
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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





app.use(`${API_ROOT}membership`, membershipRoutes);
app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}media-type`, mediaTypeRoutes)
app.use(`${API_ROOT}media`, mediaRoutes)
app.use(`${API_ROOT}activity`, activityRoutes);
app.use(`${API_ROOT}upcommingprograms`, programRoutes);
app.use(`${API_ROOT}gallery`, galleryRoutes);





app.get('/', (req, res) => {
    res.send('Hello from Node.js backend!');
  });
  
  
  
  // Database connection
  try {
      const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/Membership";
      const DB_PORT = process.env.PORT || PORT;
  
      mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
          .then(() => {
              console.log("DB Connection Successful");
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
  