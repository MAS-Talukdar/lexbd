
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: true,
  legacyHeaders: false,

  // Successful login requests will not count
  skipSuccessfulRequests: true,

  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes."
  },

  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

export default loginLimiter;
