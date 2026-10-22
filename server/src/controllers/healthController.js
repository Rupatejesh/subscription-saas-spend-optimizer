import mongoose from 'mongoose';
import { apiResponse } from '../utils/apiResponse.js';

export function getHealth(_req, res) {
  res.json(apiResponse({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  }, 'Service healthy'));
}
