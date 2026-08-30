/**
 * Consistent API Response Helper
 */
const successResponse = (res, message = 'Success', data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const errorResponse = (res, message = 'Error', error = {}, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: typeof error === 'string' ? { message: error } : error
  });
};

module.exports = {
  successResponse,
  errorResponse
};
