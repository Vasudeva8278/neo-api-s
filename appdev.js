const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require('body-parser');
const app = express();

const templateRoutes = require('./src/routes/templateRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const templateProjectRoutes = require('./src/routes/templateProjectRoutes');
const documentProjectRoutes = require('./src/routes/documentProjectRoutes');
const imageRouter = require('./src/routes/imageRouter');
const zipRoute = require('./src/routes/zipRoute');
const projectRoutes = require('./src/routes/projectsRoutes');
const organizationsRouter = require('./src/routes/organizationsRoutes');
const usersRouter = require('./src/routes/usersRoutes');
const activityLogsRouter = require('./src/routes/activityLogsRoute');
const paymentsRouter = require('./src/routes/paymentsRoute');
const { auth  } = require('./src/middleware/auth'); 


app.use(express.urlencoded({ extended: false }));
//app.use(express.json());
app.use(cors());

app.use(express.json({
  limit: "5mb"
}));
//app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

mongoose.connect("mongodb://127.0.0.1:27017/neodb-dev", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const upload = multer({ storage: multer.memoryStorage(), 
                        limits: { fieldSize: 25 * 1024 * 1024 }
});
//app.use(upload.single("docxFile"));
//app.use(upload.single("image"));
app.use('/api/users', usersRouter);
app.use('/api/templates',auth, upload.single("docxFile"), templateRoutes);
app.use('/api/documents',auth, documentRoutes);
app.use('/api/project', auth,upload.single("docxFile"), templateProjectRoutes);
app.use('/api/projectDocs', auth,documentProjectRoutes);
app.use('/api/projects',auth,projectRoutes);
app.use('/api/image', imageRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/activityLogs', activityLogsRouter);
app.use('/api/payments', paymentsRouter); 


module.exports = app;
