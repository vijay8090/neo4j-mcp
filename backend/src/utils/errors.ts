import { ERROR_CODES } from '../constants/index.js';

export class ChatError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;

  constructor(message: string, statusCode: number = 500, code: string = ERROR_CODES.INTERNAL_ERROR) {
    super(message);
    this.name = 'ChatError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends ChatError {
  constructor(message: string) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR);
    this.name = 'ValidationError';
  }
}

export class ServiceUnavailableError extends ChatError {
  constructor(message: string) {
    super(message, 503, ERROR_CODES.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

export class ConfigurationError extends ChatError {
  constructor(message: string) {
    super(message, 500, ERROR_CODES.CONFIGURATION_ERROR);
    this.name = 'ConfigurationError';
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
  };
}

export const createErrorResponse = (error: unknown): ErrorResponse => {
  if (error instanceof ChatError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        timestamp: error.timestamp
      }
    };
  }

  // Handle unknown errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    success: false,
    error: {
      message,
      code: ERROR_CODES.UNKNOWN_ERROR,
      statusCode: 500,
      timestamp: new Date().toISOString()
    }
  };
}; 