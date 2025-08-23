const jwt = require('jsonwebtoken');
const { JWT_SECRET_KEY } = process.env;

module.exports = {
  restrict: (req, res, next) => {
    try {
      let { authorization } = req.headers;
      if (!authorization || !authorization.split(' ')[1]) {
        return res.status(401).json({
          status: false,
          message: 'Token is missing or not provided',
          data: null,
        });
      }

      let token = authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        req.user = decoded;
        delete req.user.iat;
        next();
      } catch (err) {
        return res.status(401).json({
          status: false,
          message: 'Token verification failed: ' + err.message,
          data: null,
        });
      }
    } catch (error) {
      next(error);
    }
  },
  isAdmin: (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized to access this resource',
        data: null,
      });
    }
    next();
  },
  isUser: (req, res, next) => {
    if (req.user.role !== 'USER') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized to access this resource',
        data: null,
      });
    }
    next();
  },
  isUserOrAdmin: (req, res, next) => {
    if (req.user.role !== 'USER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized to access this resource',
        data: null,
      });
    }
    next();
  },
};
