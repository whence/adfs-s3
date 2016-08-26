var request = require('request');
var cheerio = require('cheerio');

var fetchAssertion = function(host, username, password, done) {
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

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('.config/main.json', { encoding: 'UTF8' }));

fetchAssertion(config.host, config.username, config.password, function (err, data) {
    if (err) {
        console.log('ERROR: ' + err);
    } else {
        console.log(data);
    }
});
