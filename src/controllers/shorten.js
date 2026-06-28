const { isValidUrl } = require("../utils/validate");
const { generateSlug } = require("../utils/slug");
const { createError } = require("../middleware/errorHandler");
const UrlModel = require("../models/url");

async function shorten(req, res, next) {
  try {
    const { url, custom_slug } = req.body;

    const { valid, reason } = isValidUrl(url);

    if (!valid) {
      throw createError(400, reason);
    }

    const userId = req.user?.id || null;

    const record = await UrlModel.create(url, userId);

    const slug = custom_slug || generateSlug(record.id);

    const fullRecord = await UrlModel.setSlug(record.id, slug);

    const baseUrl =
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    const shortUrl = `${baseUrl}/${slug}`;

    res.status(201).json({
      slug,
      short_url: shortUrl,
      long_url: fullRecord.long_url,
      created_at: fullRecord.created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { shorten };