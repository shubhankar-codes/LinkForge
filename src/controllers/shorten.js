const { isValidUrl, isValidCustomSlug } = require('../utils/validate');
const { createError } = require('../middleware/errorHandler');
const UrlModel = require('../models/url');

async function shorten(req, res, next) {
  try {
    const { url, custom_slug } = req.body || {};
    const validation = isValidUrl(url);
    if (!validation.valid) throw createError(400, validation.reason);
    if (custom_slug !== undefined) {
      const slugValidation = isValidCustomSlug(custom_slug);
      if (!slugValidation.valid) throw createError(400, slugValidation.reason);
    }
    const record = await UrlModel.create(url.trim(), req.user?.id || null, custom_slug);
    const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
    res.status(201).json({
      slug: record.slug,
      short_url: `${baseUrl}/${record.slug}`,
      long_url: record.long_url,
      created_at: record.created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { shorten };
