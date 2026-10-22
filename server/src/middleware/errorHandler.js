import { apiError } from '../utils/apiResponse.js';

export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode ?? 500;
  const message = status >= 500 ? 'Internal server error. Please try again later.' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json(apiError(message, status >= 500 ? undefined : error.details));
}
