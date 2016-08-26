// var fs = require('fs');
// var config = JSON.parse(fs.readFileSync('.config/adfs.json', { encoding: 'UTF8' }));

exports.authenticate = function (username, password, done) {
    var user = {
        username: username,
        password_hash: 'blah'
    };
    done(null, user);
    // cache.get(username, function (err, user) {
    //     if (err) {
    //         return done(err);
    //     } else if (!user) {
    //         return done(null, false);
    //     } else if (user.password != password) {
    //         return done(null, false);
    //     } else {
    //         return done(null, user);
    //     }
    // });
};
