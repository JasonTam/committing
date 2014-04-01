/* GITHUB */
var access_token;

try {
	var secrets = require('./secrets.js');
	access_token = secrets.github_access_token;
} catch (e) {
	access_token = process.env.GITHUB;
}

module.exports.access_token = access_token;

/* MONGO */
var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'committing');

	// If on NodeJitsu Server
	if (process.env.NODE_ENV == 'production' && process.env.MONGO) {
		return process.env.MONGO;
	}
	
	if (obj.username && obj.password) {
		return 'mongodb://' + obj.username + ':' + obj.password + '@'
				+ obj.hostname + ':' + obj.port + '/' + obj.db;
	} else {
		return 'mongodb://' + obj.hostname + ':' + obj.port + '/' + obj.db;
	}
};

var mongo = {
	'hostname' : 'localhost',
	'port' : 27017,
	'username' : '',
	'password' : '',
	'name' : '',
	'db' : 'committing'
};

module.exports.mongourl = generate_mongo_url(mongo);

module.exports.useragent = 'committing';
module.exports.hlBaseUrl = 'http://www.hackerleague.org';
module.exports.participationUrl = '/participations';
module.exports.ghBaseUrl = 'http://www.github.com/';