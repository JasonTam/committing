var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var scrape = require('./userScrape.js');
var app = express();

var hlBaseUrl = 'http://www.hackerleague.org';
var participationUrl = '/participations';
var hackathonUrl = '/hackathons';
var ghBaseUrl = 'http://www.github.com/';

/* GITHUB */
var access_token;

if (process.env.NODE_ENV == 'production') {
	access_token = process.env.GITHUB;
} else {
	var secrets = require('./secrets.js');
	access_token = secrets.github_access_token;
}

/* MONGO */
var mongo;
var mongourl;

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

var mongourl = generate_mongo_url(mongo);

/* website */
app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

/* pages */
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.find().sort({end: -1}).toArray(function(err, hackathons) {
			if (hackathons) {
				res.render('index', {
					hackathons: hackathons
				});
			} else {
				res.send(500);
			}

			db.close();
		});
	});
});

var buildHLUrl = function(hackathon) {
	return hlBaseUrl + '/hackathons/' + hackathon + participationUrl
}

var getType = {
	lines: function(commit, prev) {
		prev = (prev === undefined) ? 0 : prev;

		var net = commit.additions - commit.deletions;

		if (Math.abs(net) >= 1000) {
			return;
		}

		return {
					x: commit.time.getTime() / 1000,
					y: prev + net,
					additions: commit.additions,
					deletions: commit.deletions,
					committer: commit.name,
					message: commit.message
				};
	},
	files: function(commit, prev) {
		prev = (prev === undefined) ? 0 : prev;

		var net = commit.file_additions - commit.file_deletions;

		return {
					x: commit.time.getTime() / 1000,
					y: prev + net,
					additions: commit.file_additions,
					deletions: commit.file_deletions,
					committer: commit.name,
					message: commit.message
				};
	},
	commits: function(commit, prev) {
		prev = (prev === undefined) ? 0 : prev;

		return {
					x: commit.time.getTime() / 1000,
					y: prev + 1,
					additions: commit.additions,
					deletions: commit.deletions,
					committer: commit.name,
					message: commit.message
				};
	}
}

var getUrl = function(commit, category) {
	if (category == 'repo') {
		return commit['committer'] + '/' + commit['repo'];
	}

	return commit['committer'];
}

var massageCategory = function(category) {
	if (category[category.length - 1] == 's') {
		category = category.substring(0, category.length - 1);
	}

	if (category == 'user') {
		category = 'committer';
	}

	return category;
};

var plot = function(hlid, type, category, res, find) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('commits');

		var categories = {};
		var commits = []; // list of categories and their commits

		var sort = {time: 1};
		sort[category] = 1;

		collection.find(find).sort(sort).each(function(err, commit) {

			// close database
			if (commit == null) {
				db.close();
				res.send(commits);

				return;
			}

			var prev;
			if (categories[commit[category]] !== undefined && commits[categories[commit[category]]].data.length > 0) {
				prev = commits[categories[commit[category]]].data[commits[categories[commit[category]]].data.length - 1].y;
			}

			// net lines
			var next = getType[type](commit, prev);

			// add this commit to the category
			if (next) {
				// this is a new category!
				if (categories[commit[category]] === undefined) {
					categories[commit[category]] = commits.length;

					commits.push({
						name: commit[category],
						data: [],
						url: ghBaseUrl + getUrl(commit, category)
					});
				}

				commits[categories[commit[category]]].data.push(next);
			}
		});
	});
};

app.get('/api/:hlid/:type/:category', function(req, res) {
	var category = massageCategory(req.params.category);

	plot(req.params.hlid, req.params.type, category, res, {
		hlid: req.params.hlid
	});
});

app.get('/api/:hlid/:type/:category/:name', function(req, res) {
	var find = { hlid: req.params.hlid };
	var category = massageCategory(req.params.category);

	find[category] = req.params.name;

	plot(req.params.hlid, req.params.type, category, res, find);
});

app.get('/:hlid', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if (hackathon) {
				res.render('hackathon', {
					hackathon: hackathon,
					type: 'lines',
					category: 'repos',
				});
			} else {
				res.send(404);

				scrape.scrapeUrl(buildHLUrl(req.params.hlid));
			}

			db.close();
		});
	});
});

app.get('/:hlid/:type/:category', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if (hackathon) {
				res.render('hackathon', {
					hackathon: hackathon,
					type: req.params.type,
					category: req.params.category
				});
			} else {
				res.send(404);
			}

			db.close();
		});
	});
});

app.get('/:hlid/:type/:category/:name', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if (hackathon) {
				res.render('hackathon', {
					hackathon: hackathon,
					type: req.params.type,
					category: req.params.category,
					name: req.params.name
				});
			} else {
				res.send(404);
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
	var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100';
	request.get({
		uri: url,
		json: true,
		since: start.toISOString(),
		until: end.toISOString(),
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
			console.error('Error getting activity from ' + url + ' : ' + resp.statusCode);
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

setInterval(update, 1000 * 60 * 5);	