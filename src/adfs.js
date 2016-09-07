import request from 'request';
import cheerio from 'cheerio';
import AWS from 'aws-sdk';
import async from 'async';

export function isExpired(credentials, done) {
  const iam = new AWS.IAM({ credentials });
  async.reflect(cb => iam.getAccountSummary(cb))(done);
}

export function fetchAssertion(host, username, password, done) {
  const url = `https://${host}/adfs/ls/IdpInitiatedSignOn.aspx?loginToRp=urn:amazon:webservices`;
  const form = {
    UserName: username,
    Password: password,
    AuthMethod: 'urn:amazon:webservices',
  };
  const jar = request.jar();
  const options = {
    url,
    form,
    jar,
    followAllRedirects: true,
  };
  request.post(options, (err, httpResponse, body) => {
    if (err) {
      done(err);
    } else if (httpResponse.statusCode !== 200) {
      done(`Request returns ${httpResponse.statusCode}`);
    } else {
      const $ = cheerio.load(body);
      const error = $('form#loginForm #errorText').text();
      if (error) {
        done(error);
      } else {
        const assertion = $('form[name=hiddenform] input[name=SAMLResponse]').prop('value');
        if (assertion) {
          done(null, assertion);
        } else {
          done('Empty SAMLResponse');
        }
      }
    }
  });
}

export function obtainCredentials(roleArn, principalArn, assertion, done) {
  const params = {
    PrincipalArn: principalArn,
    RoleArn: roleArn,
    SAMLAssertion: assertion,
    DurationSeconds: 3600,
  };
  const sts = new AWS.STS();
  async.waterfall([
    cb => sts.assumeRoleWithSAML(params, cb),
    async.asyncify(data => ({
      accessKeyId: data.Credentials.AccessKeyId,
      secretAccessKey: data.Credentials.SecretAccessKey,
      sessionToken: data.Credentials.SessionToken,
    })),
  ], done);
}
