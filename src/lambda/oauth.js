var async   = require('async');
var request = require('request');
 
var eventbrite_client_token = process.env.EVENTBRITE_CLIENT_TOKEN;
var eventbrite_client_key= process.env.EVENTBRITE_CLIENT_KEY;

 
// A function to call Authlete's introspection API.
//
// This function is used as a task for 'waterfall' method of 'async' module.
// See https://github.com/caolan/async#user-content-waterfalltasks-callback
// for details about 'waterfall' method.
//
//   * api_key (string) [REQUIRED]
//   * api_secret (string) [REQUIRED]
//       The API credentials of a service.
//
//   * access_token (string) [REQUIRED]
//       An access token whose information you want to get.
//
//   * scopes (string array) [OPTIONAL]
//       Scopes that should be covered by the access token. If the scopes
//       are not covered by the access token, the value of 'action' in the
//       response from Authlete's introspection API is 'FORBIDDEN'.
//
//   * subject (string) [OPTIONAL]
//       A subject (= unique identifier) of an end-user who should be
//       associated with the access token. If the subject is not associated
//       with the access token, the value of 'action' in the response from
//       Authlete's introspection API is 'FORBIDDEN'.
//
//   * callback
//       A callback function that 'waterfall' of 'async' module passes to
//       a task function.
//     
function introspect(api_key, api_secret, access_token, scopes, subject, callback)
{
  request({
    // The URL of Authlete's introspection API.
    url: 'https://www.eventbrite.com/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    json: true,
    body: {
      code: access_token,
      client_secret: api_secret,
      client_id: api_id,
      greant_type: 'authorization_code'
    },
  }, function(error, response, body) {
    if (error) {
      callback(error);
    }
    else if (response.statusCode != 200) {
      callback(response);
    }
    else {
      callback(null, body);
    }
  });
}
 
function main(event, context, info)
{
  // Returns a JSON.
  context.succeed({
    "Hello": "World",
 
    // The ID of the client application that is associated with the access token.
    "clientId": info.clientId,
 
    // The subject (= unique identifier) of the end-user that is associated with
    // the access token. This is not available if the access token has been created
    // by using 'Client Credentials Flow' (RFC 6749, 4.4. Client Credentials Grant).
    "subject": info.subject,
 
    // The scopes (= permissions) that are associated with the access token.
    // This may be null.
    "scopes": info.scopes
  });
}
 
// The entry point of this lambda function.
exports.handler = function(event, context, cb) {
  // [string] The access token that the client application presented.
  // The value comes from the request parameter 'access_token'.
  var access_token = event.access_token;

  if (!access_token) {
    return cb(null, {
      isBase64Encoded: false,
      statusCode: 302,
      body: 'https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=' + eventbrite_client_token
    });
  }

 
  // [string array] Scopes (= permissions) that this REST API requires.
  // In this example, no scope is required.
  var scopes = null;
 
  // [string] The subject (= unique identifier) of the end-user that
  // this REST API expects the access token to be associated with.
  // In this example, no specific subject is required.
  var subject = null;
 
  // Validate the access token and then invoke the main code.
  async.waterfall([
    function(callback) {
      // Validate the access token by calling Authlete's introspection API.
      introspect(eventbrite_client_token, eventbrite_client_key, access_token, scopes, subject, callback);
    },
    function(response, callback) {
      switch (response.action) {
        case 'OK':
          // The access token is valid. Execute the main code.
          main(event, context, response);
          break;
 
        default:
          // The access token is not valid or another different problem
          // has happened. The format of the error message we are about
          // to construct is as follows.
          //
          //     {action}:{resultMessage}
          //
          // Possible values that {action} takes here are as follows:
          //
          //     BAD_REQUEST
          //     UNAUTHORIZED
          //     FORBIDDEN
          //     INTERNAL_SERVER_ERROR
          //
          // This error message format is important because its regular
          // expression is referred to in 'Integration Response' section
          // of Amazon API Gateway.
          context.fail(response.action + ":" + response.resultMessage);
          break;
      }
 
      callback(null);
    }
  ], function (error) {
    if (error) {
      // Something wrong has happened.
      context.fail(error);
    }
  });
};
