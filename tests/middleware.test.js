const { createError, errorHandler, notFound } = require('../src/middleware/errorHandler');

// ── createError ───────────────────────────────────────────────
describe('createError()', () => {
  test('sets status and message correctly', () => {
    const err = createError(404, 'Not found');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
  });

  test('returns an Error instance', () => {
    expect(createError(400, 'Bad input')).toBeInstanceOf(Error);
  });

  test('sets isCustom flag', () => {
    expect(createError(422, 'test').isCustom).toBe(true);
  });

  test('works for all common HTTP status codes', () => {
    [400, 401, 403, 404, 409, 410, 422, 429, 500].forEach(code => {
      expect(createError(code, 'msg').status).toBe(code);
    });
  });
});

// ── errorHandler middleware ───────────────────────────────────
describe('errorHandler()', () => {
  // Mock Express res object
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  };

  test('responds with correct status code', () => {
    const err = createError(404, 'Not found');
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('response body has error.message', () => {
    const err = createError(400, 'Invalid URL');
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('Invalid URL');
  });

  test('defaults to 500 for errors without status', () => {
    const err = new Error('Something exploded');
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('response always has error.status field', () => {
    const err = createError(422, 'Unprocessable');
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    const body = res.json.mock.calls[0][0];
    expect(body.error.status).toBe(422);
  });
});

// ── notFound middleware ───────────────────────────────────────
describe('notFound()', () => {
  test('calls next() with a 404 error', () => {
    const req  = { method: 'GET', path: '/nonexistent' };
    const next = jest.fn();
    notFound(req, {}, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404 })
    );
  });

  test('error message includes method and path', () => {
    const req  = { method: 'DELETE', path: '/api/thing' };
    const next = jest.fn();
    notFound(req, {}, next);
    const err = next.mock.calls[0][0];
    expect(err.message).toContain('DELETE');
    expect(err.message).toContain('/api/thing');
  });
});

// ── Rate limiter config sanity check ─────────────────────────
describe('rateLimiter config', () => {
  test('shortenLimiter and redirectLimiter are exported', () => {
    const { shortenLimiter, redirectLimiter, authLimiter } = require('../src/middleware/rateLimiter');
    expect(typeof shortenLimiter).toBe('function');
    expect(typeof redirectLimiter).toBe('function');
    expect(typeof authLimiter).toBe('function');
  });
});