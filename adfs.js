var request = require('request');
var cheerio = require('cheerio');
var AWS = require('aws-sdk');

exports.isExpired = function (credentials, done) {
    var iam = new AWS.IAM({ credentials: credentials });
    iam.getAccountSummary(function (err) {
        if (err) {
            done(null, true);
        } else {
            done(null, false);
        }
    });
};

exports.fetchAssertion = function (host, username, password, done) {
    var url = 'https://' + host + '/adfs/ls/IdpInitiatedSignOn.aspx?loginToRp=urn:amazon:webservices';
    var form = {
        UserName: username,
        Password: password,
        AuthMethod: 'urn:amazon:webservices'
    };
    var jar = request.jar();
    var options = {
        url: url,
        form: form,
        jar: jar,
        followAllRedirects: true
    };
    request.post(options, function (err, httpResponse, body) {
        if (err) {
            done(err);
        } else if (httpResponse.statusCode !== 200) {
            done('Request returns ' + httpResponse.statusCode);
        } else {
            var $ = cheerio.load(body);
            var error = $('form#loginForm #errorText').text();
            if (error) {
                done(error);
            } else {
                var assertion = $('form[name=hiddenform] input[name=SAMLResponse]').prop('value');
                if (assertion) {
                    done(null, assertion);
                } else {
                    done('Empty SAMLResponse');
                }
            }
        }
    });
};

exports.obtainCredentials = function (roleArn, principalArn, assertion, done) {
    var params = {
        PrincipalArn: principalArn,
        RoleArn: roleArn,
        SAMLAssertion: assertion,
        DurationSeconds: 3600
    };
    var sts = new AWS.STS();
    sts.assumeRoleWithSAML(params, function (err, data) {
        if (err) {
            done(err);
        } else {
            done(null, data.Credentials);
        }
    });
};
