# Raygun4Node

Raygun.io plugin for Node

## Getting Started
Install the module with: `npm install raygun`

```javascript
var raygun = require('raygun');
var raygunClient = new raygun.Client().init({ apiKey: 'your API key' });
raygunClient.send(theError);

// For express, at the end of the middleware definitions:
app.use(raygunClient.expressHandler);
```

## Documentation

### Sending custom data

You can pass custom data in on the Send() function, as the second parameter. For instance (based off the call in test/raygun_test.js):

```javascript
client.send(new Error(), { 'mykey': 'beta' }, function (response){
```

### Unique user tracking

New in 0.4: You can set **raygunClient.user** to a function that returns the user name or email address of the currently logged in user.

An example, using the Passport.js middleware:

```javascript
var raygunClient = new raygun.Client().init({apiKey: "yourkey"});

raygunClient.user = function (req) {
  if (req.user) {
    return req.user.username;
  }
}
```

####raygunClient.user(req)

**Param**: *req*: the current request.

This will be transmitted with each message sent, and a count of affected users will appear on the dashboard in the error group view. If you pass in an email address, and the user has associated a Gravatar with it, their picture will be also displayed.

**Note:** setUser deprecated in 0.4

Release 0.3 previously had a setUser function that accepted a string or function to specify the user, however it did not accept arguments. This method is considered deprecated and will be removed in the 1.0 release, thus it is advised to update your code to set it with the new *user* function.

### Version tracking

Call setVersion(*string*) on a RaygunClient to set the version of the calling application. This is expected to be of the format x.x.x.x, where x is a positive integer. The version will be visible in the dashboard.

### Examples
View a screencast on creating an app with Node.js and Express.js, then hooking up the error handling and sending them at [http://raygun.io/blog/2013/07/video-nodejs-error-handling-with-raygun/](http://raygun.io/blog/2013/07/video-nodejs-error-handling-with-raygun/)

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
- 0.4.1 - Fixed issue where getting cpu information returned undefined
- 0.4.0 - Added *user* function, deprecated setUser
- 0.3.0 - Added version and user tracking functionality; bump jshint version, update test
- 0.2.0 - Added Express handler, bug fixes
- 0.1.2 - Include more error information
- 0.1.1 - Point at the correct API endpoint, include correct dependencies for NPM
- 0.1.0 - Initial release

## License
Copyright (c) 2013 MindscapeHQ
Licensed under the MIT license.
