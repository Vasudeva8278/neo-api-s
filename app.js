const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require('express-session');
const passport = require('passport');
const app = express();

const templateRoutes = require("./src/routes/templateRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const templateProjectRoutes = require("./src/routes/templateProjectRoutes");
const documentProjectRoutes = require("./src/routes/documentProjectRoutes");
const imageRouter = require("./src/routes/imageRouter");
const projectRoutes = require("./src/routes/projectsRoutes");
const organizationsRouter = require("./src/routes/organizationsRoutes");
const usersRouter = require("./src/routes/usersRoutes");
const activityLogsRouter = require("./src/routes/activityLogsRoute");
const paymentsRouter = require("./src/routes/paymentsRoute");
const profileRouter = require("./src/routes/profileRoutes");
const clientRouter = require("./src/routes/clientRoutes");
const roleRoutes = require("./src/routes/roleRoutes")
const googleAuthRoutes = require("./src/routes/googleAuthRoutes");

app.use(express.urlencoded({ extended: false }));
//app.use(express.json());
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(
  express.json({
    limit: "10mb",
  })
);
//app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 25 * 1024 * 1024 },
});
//app.use(upload.single("docxFile"));
//app.use(upload.single("image"));

app.use("/api/auth", googleAuthRoutes);
app.use("/api/users", usersRouter);
app.use("/api/templates", upload.single("docxFile"), templateRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/project", upload.single("docxFile"), templateProjectRoutes);
app.use("/api/projectDocs", documentProjectRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/image", imageRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/activityLogs", activityLogsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/clients", clientRouter);
app.use("/api/profile", profileRouter);
app.use("/api/roles",roleRoutes)
app.use("/api/projectDocs", templateProjectRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", message: "The server is healthy!" });
});

module.exports = app;
