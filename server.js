var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var scrape = require('./userScrape.js');
var app = express();

app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

var start = new Date('2013-09-28T18:00Z');
var access_token = "9b73db13aedb532621c2318d0bc5c5d6955a4805";

var mongo;
var mongourl;

var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'powerdata');
	

	// If on NodeJitsu Server
	if (process.env.NODE_ENV=='production') {
		console.log("inside");
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
console.log(mongourl);
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
						y: prev_net + net,
						additions: commit.additions,
						deletions: commit.deletions,
						committer: commit.name,
						message: commit.message
					});
				} else {
					commits[repos[commit.repo]].data.push({
						x: commit.time.getTime() / 1000,
						y: net,
						additions: commit.additions,
						deletions: commit.deletions,
						committer: commit.name,
						message: commit.message
					});
				}
			}
		});
	});
});

var insertCommit = function(data) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection("commits", function(err, collection) {
			
			collection.ensureIndex('time', function() {
				// console.log(data);

				/* Note the _id has been created */
				collection.insert(data, {
					safe : true
				}, function(err, result) {
					if (err) console.warn(err.message);
				});
				
				db.close();
			});
		});
	});
}

var getCommitDetail = function(owner, repo, sha) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits/' + sha,
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var time = new Date(body.commit.committer.date);
			var net_lines = body.stats.additions - body.stats.deletions;

			console.log(repo + ',' + body.commit.committer.name + ',' + net_lines + ',' + time.toISOString());

			insertCommit({
				time: time,
				repo: repo,
				owner: owner,
				name: body.commit.committer.name,
				username: body.author.login,
				additions: body.stats.additions,
				deletions: body.stats.deletions,
				message: body.commit.message,
				sha: sha
			});

		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting commit from ' + owner + '/' + repo + ': ' + resp.statusCode);
		}
	});
}

var checkCommit = function(owner, repo, commit) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }

		var collection = db.collection('commits');
		collection.findOne({
			sha: commit.sha
		}, function(err, single) {
			if (!single) {
				getCommitDetail(owner, repo, commit.sha);
			}

			db.close();
		});
	});
}

var getActivity = function(owner, repo) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100',
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			for (var c in body) {
				var commit = body[c];

				var time = new Date(commit.commit.committer.date);

				if (time > start) {
					checkCommit(owner, repo, commit);
				}
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting activity from ' + owner + '/' + repo + ': ' + resp.statusCode);
		}
	});
}

var update = function() {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');
		collection.distinct('repo', function(err, repos) {

			for (var r in repos) {
				var repo = repos[r];

				collection.findOne({'repo': repo}, function(err, rep) {
					getActivity(rep.owner, rep.repo);
				});
			}

			// probably should close.
			// db.close();
		});
	});
}

if (process.env.NODE_ENV == 'production') {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection("commits", function(err, collection) {
			
			collection.remove(function() {
				db.close();

				scrape();
			});
		});
	});
}
setInterval(update, 1000 * 60 * 5);	