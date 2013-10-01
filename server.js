var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var scrape = require('./userScrape.js');
var app = express();

app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

var access_token = '9b73db13aedb532621c2318d0bc5c5d6955a4805';

var mongo;
var mongourl;

var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'committing');
	

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

/* pages */
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: 'fall-2013-hackny-student-hackathon'}, function(err, hackathon) {
			console.log(hackathon);

			if (hackathon) {
				res.render('index', {
					hackathon: hackathon,
					dataUrl: '/api/' + hackathon.hlid + '/repos'
				});
			}

			db.close();
		});
	});
});

app.get('/api/:hlid/repos', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var repos = {}; // set of repos
		var commits = []; // list of repos and their commits

		collection.find({hlid: req.params.hlid}).sort({time: 1, repo: 1}).each(function(err, commit) {

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

app.get('/api/:hlid/users', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var users = {}; // set of users
		var commits = []; // list of users and their commits

		collection.find({hlid: req.params.hlid}).sort({time: 1, committer: 1}).each(function(err, commit) {

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
				if (users[commit.committer] === undefined) {
					users[commit.committer] = commits.length;

					commits.push({
						name: commit.committer,
						data: []
					})
				}

				if (commits[users[commit.committer]].data.length > 0) {
					var prev_net = commits[users[commit.committer]].data[commits[users[commit.committer]].data.length - 1].y;

					commits[users[commit.committer]].data.push({
						x: commit.time.getTime() / 1000,
						y: prev_net + net,
						additions: commit.additions,
						deletions: commit.deletions,
						committer: commit.name,
						message: commit.message
					});
				} else {
					commits[users[commit.committer]].data.push({
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

app.get('/api/:hlid/deletes', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var users = {}; // set of users
		var commits = []; // list of users and their commits

		collection.find({hlid: req.params.hlid}).sort({time: 1, committer: 1}).each(function(err, commit) {

			// close database
			if (commit == null) {
				db.close();
				res.send(commits);

				return;
			}

			// net lines
			var net = commit.additions - commit.deletions;

			// add this commit to the repo
			if (commit.deletions < 100) {
				// this is a new repo!
				if (users[commit.committer] === undefined) {
					users[commit.committer] = commits.length;

					commits.push({
						name: commit.committer,
						data: []
					})
				}

				if (commits[users[commit.committer]].data.length > 0) {
					var prev_net = commits[users[commit.committer]].data[commits[users[commit.committer]].data.length - 1].y;

					commits[users[commit.committer]].data.push({
						x: commit.time.getTime() / 1000,
						y: commit.deletions,
						additions: commit.additions,
						deletions: commit.deletions,
						committer: commit.name,
						message: commit.message
					});
				} else {
					commits[users[commit.committer]].data.push({
						x: commit.time.getTime() / 1000,
						y: commit.deletions,
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

app.get('/api/:hlid/commits', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var repos = {}; // set of repos
		var commits = []; // list of repos and their commits

		collection.find({hlid: req.params.hlid}).sort({time: 1, repo: 1}).each(function(err, commit) {

			// close database
			if (commit == null) {
				db.close();
				res.send(commits);

				return;
			}
			
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
					y: prev_net + 1,
					additions: commit.additions,
					deletions: commit.deletions,
					committer: commit.name,
					message: commit.message
				});
			} else {
				commits[repos[commit.repo]].data.push({
					x: commit.time.getTime() / 1000,
					y: 1,
					additions: commit.additions,
					deletions: commit.deletions,
					committer: commit.name,
					message: commit.message
				});
			}
		});
	});
});

app.get('/:hlid', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			console.log(hackathon);

			if (hackathon) {
				res.render('index', {
					hackathon: hackathon,
					dataUrl: '/api/' + hackathon.hlid + '/repos'
				});
			}

			db.close();
		});
	});
});

app.get('/:hlid/:type', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			console.log(hackathon);

			if (hackathon) {
				res.render('index', {
					hackathon: hackathon,
					dataUrl: '/api/' + hackathon.hlid + '/' + req.params.type
				});
			}

			db.close();
		});
	});
});

/* github update */

var checkCommit = function(hlid, owner, repo, commit, end) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }

		var collection = db.collection('commits');
		collection.findOne({
			sha: commit.sha
		}, function(err, single) {
			if (!single) {
				scrape.storeCommit(hlid, owner, repo, commit.sha, end);
			}

			db.close();
		});
	});
}

var getActivity = function(hlid, owner, repo, start, end) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100',
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			for (var c in body) {
				var commit = body[c];

				var time = new Date(commit.commit.committer.date);

				if (time > start && time <= end) {
					checkCommit(hlid, owner, repo, commit, end);
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

		var now = new Date();
		
		var collection = db.collection('commits');

		collection.distinct('repo', {end: {$gte: now}}, function(err, repos) {

			for (var r in repos) {
				var repo = repos[r];

				collection.findOne({'repo': repo}, function(err, commit) {
					// only add newer commits
					getActivity(commit.hlid, commit.owner, commit.repo, commit.time, commit.end);
				});
			}

			// probably should close.
			// db.close();
		});
	});
}

/* first time setup */

if (process.env.NODE_ENV == 'production') {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection('commits', function(err, collection) {
			
			collection.remove(function() {
				db.close();

				scrape.scrapeUrl('http://www.hackerleague.org/hackathons/fall-2013-hackny-student-hackathon/participations');
			});
		});
	});
}

setInterval(update, 1000 * 60 * 5);	