var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var app = express();

app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

var access_token = "9b73db13aedb532621c2318d0bc5c5d6955a4805";

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
				sha: sha
			});

		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting commit from ' + owner + '/' + repo + ': ' + resp.statusCode);
		}
	});
}

var checkCommit = function(commit) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');
		if (!collection.find({
			sha: commit.sha
		}).limit(1)) {
			getCommitDetail(owner, repo, commit.sha);
		};

		db.close();
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

				checkCommit(commit);
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

			collection.find({'repo': repos}).each(function(err, repo) {
				if (repo == null) {
					db.close();

					return;
				}

				getActivity(repo.owner, repo.repo);
			});
		});
	});
}

update();