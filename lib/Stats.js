var Harvester = require('./Harvester.js');

var StatsCollector = function (opts) {
  if (!opts) {
    opts = {};
  }
  this._innerCounters = {};
  this.harvester = new Harvester();
  this._setMaxCountersValue(opts.maxCountersValue || 50);
  this.communicator = new (require('./transports/' + (opts.transport || 'http') + '.js'))(opts);
};
StatsCollector.prototype.sendSystemInfo = function (interval) {
  this.harvester.on('info::systemInfo', this.communicator.broadcast.bind(this.communicator));
  var intervalHandler = function () {
    this.harvester.getSystemInfo();
  };
  setInterval(intervalHandler.bind(this), interval);
};
StatsCollector.prototype.sendProcessInfo = function (interval) {
  this.harvester.on('info::processInfo', this.communicator.broadcast.bind(this.communicator));
  var intervalHandler = function () {
    this.harvester.getProcessInfo();
  };
  setInterval(intervalHandler.bind(this), interval);
};
StatsCollector.prototype._setMaxCountersValue = function (maxValue) {
  var self = this;
  this.harvester.on('counter::*', function (counterData) {
    var counterName = this.event.split('::')[1];
    self.harvester.counters[counterName].eventName = this.event;
    if (self.harvester.counters[counterName].total >= maxValue) {
      self.communicator.broadcast.call(self.communicator, self.harvester.counters[counterName]);
      self.harvester.counters[counterName] = {'total': 0, 'start': Date.now()};
    }
  });
};
StatsCollector.prototype.counter = function (counterName, data) {
  if (!this._innerCounters[counterName]) {
    this._innerCounters[counterName] = this.harvester.getCounter(counterName);
  } else {
    this._innerCounters[counterName](data);
  }
};

StatsCollector.prototype.useCounters = function (getters) {
  var counters = {};
  for (var i in getters) {
    if (typeof getters[i] === 'function') {
      counters[i] = {};
      counters[i].counter = this.harvester.getCounter(i);
      counters[i].func = getters[i];
    }
  }
  return function (req, res, next) {
    for (var i in counters) {
      counters[i].counter(counters[i].func(req, res));
    }
    next();
  };
};
StatsCollector.prototype.attach = function (app) {
  var self = this;
  app.use(function (req, res, next) {
    req.stats = res.stats = self;
    next();
  });
  return app;
};
module.exports = StatsCollector;

