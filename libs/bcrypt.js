const { hash, compare } = require('bcrypt');
const SALT = 10;

module.exports = {
  generateHash: async (password) => {
    return await hash(password, SALT);
  },
  compareHash: async (password, hash) => {
    return await compare(password, hash);
  }
};
