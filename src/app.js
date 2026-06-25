require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

require("./lib/db");
require("./lib/cache");

const apiRoutes = require("./routes/api");
const redirectRoutes = require("./routes/redirect");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

app.use("/api", apiRoutes);
app.use("/", redirectRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;