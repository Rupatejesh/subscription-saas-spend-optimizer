const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_PATTERN.test(email.trim());
}

export function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= PASSWORD_MIN_LENGTH
    && password.length <= PASSWORD_MAX_LENGTH;
}

export function validateRegistration(body = {}) {
  const errors = {};
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) {
    errors.name = 'Name must be between 2 and 80 characters.';
  }
  if (!validateEmail(body.email)) errors.email = 'Enter a valid email address.';
  if (!validatePassword(body.password)) errors.password = 'Password must be between 12 and 128 characters.';
  return errors;
}

export function validateLogin(body = {}) {
  const errors = {};
  if (!validateEmail(body.email)) errors.email = 'Enter a valid email address.';
  if (typeof body.password !== 'string' || body.password.length === 0 || body.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

export function validateProfile(body = {}) {
  const errors = {};
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) {
    errors.name = 'Name must be between 2 and 80 characters.';
  }
  return errors;
}

export function validatePasswordChange(body = {}) {
  const errors = {};
  if (typeof body.currentPassword !== 'string' || !body.currentPassword) errors.currentPassword = 'Enter your current password.';
  if (!validatePassword(body.newPassword)) errors.newPassword = 'New password must be between 12 and 128 characters.';
  if (body.newPassword !== body.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}
