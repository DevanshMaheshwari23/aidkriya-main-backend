const { validationResult } = require('express-validator');

// Check validation results
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ 
      field: err.param, 
      message: err.msg 
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors
    });
  }
  
  next();
};

// Custom validators
exports.validators = {
  // Validate phone number
  isValidPhone: (value) => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(value)) {
      throw new Error('Invalid phone number. Must be 10 digits.');
    }
    return true;
  },

  // Validate email
  isValidEmail: (value) => {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(value)) {
      throw new Error('Invalid email format.');
    }
    return true;
  },

  // Validate password strength
  isStrongPassword: (value) => {
    if (value.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    return true;
  },

  // Validate coordinates
  isValidCoordinate: (value, { req }) => {
    const lat = parseFloat(value);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error('Invalid latitude. Must be between -90 and 90.');
    }
    return true;
  },

  // Validate longitude
  isValidLongitude: (value) => {
    const lon = parseFloat(value);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      throw new Error('Invalid longitude. Must be between -180 and 180.');
    }
    return true;
  }
};
