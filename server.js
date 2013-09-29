var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var app = express();

app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

var mongo;
var mongourl;
 
var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'powerdata');
	
	// If on NodeJitsu Server
	if (process.env.NODE_ENV=='production') {
		return 'mongodb://nodejitsu:dffd4e320b733a127ea2e371f7c4f926@paulo.mongohq.com:10060/nodejitsudb2293466096';
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

var mongourl = generate_mongo_url(mongo);

app.get('/commits', function(req, res) {
	var repo = req.query['repo'] ? req.query['repo'] : 'committing';
	
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');
		collection.find({'repo': repo}).toArray(function(err, documents) {
			res.send(documents);

			db.close();
		});
	});
});

app.get('/commits/rickshaw', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var repos = {}; // set of repos
		var commits = []; // list of repos and their commits

		collection.find().sort({time: 1}).each(function(err, commit) {

			// close database
			if (commit == null) {
				db.close();
				res.send(commits);

				return;
			}

			// net lines
			var net = commit.additions - commit.deletions;

			// add this commit to the repo
			if (net < 1000) {
				// this is a new repo!
				if (repos[commit.repo] === undefined) {
					repos[commit.repo] = commits.length;

					commits.push({
						name: commit.owner + '/' + commit.repo,
						data: []
					})
				}

				if (commits[repos[commit.repo]].data.length > 0) {
					var prev_net = commits[repos[commit.repo]].data[commits[repos[commit.repo]].data.length - 1].y;

					commits[repos[commit.repo]].data.push({
						x: commit.time.getTime() / 1000,
						y: prev_net + net
					});
				} else {
					commits[repos[commit.repo]].data.push({
						x: commit.time.getTime() / 1000,
						y: net
					});
				}
			}
		});
	});
});