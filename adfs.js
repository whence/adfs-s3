var request = require('request');

exports.fetchAssertion = function(host, username, password, done) {
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
        jar: jar
    };
    request.post(options, function (err, httpResponse, body) {
        if (err) {
            done(err, null);
        } else {
            console.log(body);
        }
    });
};

exports.fetchAssertion();
