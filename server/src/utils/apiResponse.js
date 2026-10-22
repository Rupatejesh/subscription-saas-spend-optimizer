export function apiResponse(data, message = 'OK') {
  return { success: true, message, data };
}

export function apiError(message, details) {
  return { success: false, message, ...(details ? { details } : {}) };
}
