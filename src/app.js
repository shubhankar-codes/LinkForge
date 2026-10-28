require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

require("./lib/db");
require("./lib/cache");

const apiRoutes = require("./routes/api");
const redirectRoutes = require("./routes/redirect");

// Import rate limiter
const { redirectLimiter } = require("./middleware/rateLimiter");

// Import error middleware
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Configure only the trusted proxy hops/addresses used by your deployment.
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value.split(',').map(x => x.trim()));
}

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

// API routes
app.use("/api", apiRoutes);

// Redirect routes with rate limiter
app.use("/", redirectLimiter, redirectRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (require.main === module) app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;