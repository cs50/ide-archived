'use strict';

var MessageBuilder = require('../lib/raygun.messageBuilder.js');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports['basic builder tests'] = {
  setUp: function (done) {
    var builder = new MessageBuilder();
    this.message = builder.build();
    done();
  },
  messageBuild: function (test) {
    test.ok(this.message);
    test.done();
  },
  builtMessageIncludesOccurredOn: function (test) {
    test.ok(this.message.occurredOn);
    test.done();
  },
  messageIncludesDetails: function (test) {
    test.ok(this.message.details);
    test.done();
  },
  messageIncludesClientDetails: function (test) {
    test.ok(this.message.details.client, 'provider information not included');
    test.ok(this.message.details.client.name, 'provider name not included');
    test.ok(this.message.details.client.version, 'provider version not included');
    test.done();
  },
  setMachineNameIncluded: function (test) {
    var builder = new MessageBuilder();
    builder.setMachineName('server1');
    var message = builder.build();
    test.equals(message.details.machineName, 'server1');
    test.done();
  },
  defaultMachineNameIncluded: function (test) {
    var builder = new MessageBuilder();
    builder.setMachineName();
    var message = builder.build();
    test.ok(message.details.machineName);
    test.done();
  }
};

exports['error builder tests'] = {
  setUp: function (done) {
    var builder = new MessageBuilder();
    builder.setErrorDetails(new Error());
    this.message = builder.build();
    done();
  },
  messageIncludesError: function (test) {
    test.ok(this.message.details.error);
    test.done();
  },
  messageIncludesErrorStackTrace: function (test) {
    test.ok(this.message.details.error.stackTrace);
    test.equal(this.message.details.error.stackTrace.length, 10);
    test.done();
  },
  messageIncludesErrorStackTraceCorrectly: function (test) {
    var stackTrace = this.message.details.error.stackTrace;
    stackTrace.forEach(function (stackTraceLine) {
      test.ok(stackTraceLine.lineNumber);
      test.ok(stackTraceLine.className);
      test.ok(stackTraceLine.fileName);
      test.ok(stackTraceLine.methodName);
    });
    test.done();
  },
  messageIncludesTheErrorMessage: function (test) {
    var errorMessage = 'WarpCoreAlignment';
    var builder = new MessageBuilder();
    builder.setErrorDetails(new Error(errorMessage));
    var message = builder.build();
    test.ok(message.details.error.message);
    test.equals(message.details.error.message, errorMessage);
    test.done();
  },
  messageIncludeTheErrorMessageWhenNoneProvided: function (test) {
    test.ok(this.message.details.error.message);
    test.equals(this.message.details.error.message, 'NoMessage');
    test.done();
  },
  messageIncludesClassName: function (test) {
    test.ok(this.message.details.error.className);
    test.equals(this.message.details.error.className, 'Error');
    test.done();
  }
};

exports['environment builder tests'] = {
  setUp: function (done) {
    var builder = new MessageBuilder();
    builder.setEnvironmentDetails();
    this.message = builder.build();
    done();
  },
  environmentDetailsSet: function (test) {
    test.ok(this.message.details.environment);
    test.done();
  },
  processorCountSet: function (test) {
    test.ok(this.message.details.environment.processorCount);
    test.done();
  },
  osVersionSet: function (test) {
    test.ok(this.message.details.environment.osVersion);
    test.done();
  },
  cpuSet: function (test) {
    test.ok(this.message.details.environment.cpu);
    test.done();
  },
  architectureSet: function (test) {
    test.ok(this.message.details.environment.architecture);
    test.done();
  },
  totalPhysicalMemorySet: function (test) {
    test.ok(this.message.details.environment.totalPhysicalMemory);
    test.done();
  },
  availablePhysicalMemorySet: function (test) {
    test.ok(this.message.details.environment.availablePhysicalMemory);
    test.done();
  },
  utcOffsetIncluded: function (test) {
    test.ok(this.message.details.environment.utcOffset);
    test.done();
  }
};

exports['custom data builder tests'] = {
  allowCustomDataToBeSet: function (test) {
    var builder = new MessageBuilder();
    builder.setUserCustomData({ foo: 'bar' });
    var message = builder.build();
    test.ok(message.details.userCustomData);
    test.equals(message.details.userCustomData.foo, 'bar');
    test.done();
  },
  allowEmptyCustomDataToBeSet: function (test) {
    var builder = new MessageBuilder();
    builder.setUserCustomData();
    var message = builder.build();
    test.equals(message.details.userCustomData, undefined);
    test.done();
  }
};

exports['express request builder tests'] = {
  setUp: function (done) {
    var builder = new MessageBuilder();
    builder.setRequestDetails({ host: 'localhost' });
    this.message = builder.build();
    done();
  },
  hostNameIsSet: function (test) {
    test.ok(this.message.details.request.hostName);
    test.done();
  }
};

exports['user and version builder tests'] = {
  userSet: function (test) {
    var builder = new MessageBuilder();
    builder.setUser('testuser');
    this.message = builder.build();
    test.equals(this.message.details.user.identifier, 'testuser');
    test.done();
  },
  userSetFunction: function (test) {
    var builder = new MessageBuilder();
    builder.setUser(function() { return 'testuser'; });
    this.message = builder.build();
    test.equals(this.message.details.user.identifier, 'testuser');
    test.done();
  },
  versionSet: function (test) {
    var builder = new MessageBuilder();
    builder.setVersion('1.0.0.0');
    this.message = builder.build();
    test.equals(this.message.details.version, '1.0.0.0');
    test.done();
  }
};
