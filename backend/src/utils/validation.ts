import { API_CONFIG } from '../constants/index.js';

export interface ChatRequest {
  prompt?: string;
  message?: string;
}

// Validation helper functions
export const validateChatRequest = (data: any): { success: true; data: ChatRequest } | { success: false; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const { prompt, message } = data;
  
  // Check if at least one field is provided
  if (!prompt && !message) {
    errors.push("Either 'prompt' or 'message' field is required");
  }
  
  // Validate prompt if provided
  if (prompt !== undefined) {
    if (typeof prompt !== 'string') {
      errors.push("'prompt' must be a string");
    } else if (prompt.trim().length === 0) {
      errors.push("'prompt' cannot be empty");
    } else if (prompt.length > API_CONFIG.MAX_PROMPT_LENGTH) {
      errors.push(`'prompt' cannot exceed ${API_CONFIG.MAX_PROMPT_LENGTH} characters`);
    }
  }
  
  // Validate message if provided
  if (message !== undefined) {
    if (typeof message !== 'string') {
      errors.push("'message' must be a string");
    } else if (message.trim().length === 0) {
      errors.push("'message' cannot be empty");
    } else if (message.length > API_CONFIG.MAX_PROMPT_LENGTH) {
      errors.push(`'message' cannot exceed ${API_CONFIG.MAX_PROMPT_LENGTH} characters`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { prompt, message } };
};

export const sanitizePrompt = (prompt: string): string => {
  // Basic sanitization - remove excessive whitespace and trim
  return prompt
    .trim()
    .replace(/\s+/g, ' ')
  //  .substring(0, 2000); // Ensure max length
};

export const validateEnvironment = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY environment variable is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 