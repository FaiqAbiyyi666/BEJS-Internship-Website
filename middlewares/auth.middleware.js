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

  // ✅ hanya admin
  isAdmin: (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized as Admin',
        data: null,
      });
    }
    next();
  },

  // ✅ hanya peserta magang
  isPesertaMagang: (req, res, next) => {
    if (req.user.role !== 'peserta_magang') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized as Peserta Magang',
        data: null,
      });
    }
    next();
  },

  // ✅ hanya sub koordinator magang
  isSubKoordinatorMagang: (req, res, next) => {
    if (req.user.role !== 'sub_koordinator_magang') {
      return res.status(403).json({
        status: false,
        message: 'You are not authorized as Sub Koordinator Magang',
        data: null,
      });
    }
    next();
  },

  // ✅ admin atau peserta magang
  isAdminOrPeserta: (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'peserta_magang') {
      return res.status(403).json({
        status: false,
        message: 'Only Admin or Peserta Magang can access this resource',
        data: null,
      });
    }
    next();
  },

  // ✅ admin atau sub koordinator
  isAdminOrSubKoordinator: (req, res, next) => {
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'sub_koordinator_magang'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Only Admin or Sub Koordinator can access this resource',
        data: null,
      });
    }
    next();
  },
};
