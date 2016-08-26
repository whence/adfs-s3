var expect = require('expect.js');
var auth = require('../auth');

describe('authenticate', function() {
    it('should return user with password hash', function () {
        auth.authenticate('user1', 'pass1', function (err, user) {
            expect(err).to.not.be.ok();
            expect(user.username).to.be('user1');
            expect(user).to.have.property('password_hash');
        });
    });
});
