function log(req, res, next) {
  console.log('Logging...', new Date());
  next();
}

module.exports = log;