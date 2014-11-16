var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var moment = require('moment');
var scrape = require('./scrape.js');
var settings = require('./settings.js');
var app = express();

/* website */
app.use(express.static(__dirname + '/public'));

app.listen(process.env.PORT || 8080);

/* pages */
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.find().sort({end: -1}).toArray(function(err, hackathons) {
			if (hackathons) {
				res.render('index', {
					hackathons: hackathons
				});
			} else {
				res.status(500).end();
			}

			db.close();
		});
	});
});

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
					owner: commit.owner,
					sha: commit.sha,
					repo: commit.repo,
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
					owner: commit.owner,
					sha: commit.sha,
					repo: commit.repo,
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
					owner: commit.owner,
					sha: commit.sha,
					repo: commit.repo,
					message: commit.message
				};
	}
}

var getUrl = function(commit, category) {
	if (category == 'repo') {
		return commit['owner'] + '/' + commit['repo'];
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
	MongoClient.connect(settings.mongourl, function(err, db) {
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
						url: settings.ghBaseUrl + getUrl(commit, category)
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

app.get('/scrape/:hlid', function(req, res) {
	scrape.scrape(req.params.hlid);
	res.status(404).end();
});

app.get('/hackathons/:hlid', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if(err) { return console.dir(err); }
			
			if (hackathon) {
				res.render('hackathon', {
					hackathon: hackathon,
					type: 'lines',
					category: 'repos',
				});
			} else {
				res.status(404).end();
			}

			db.close();
		});
	});
});

var timeline = function(db, hackathon, res, find) {
	var collection = db.collection('commits');

	find = find === undefined ? {hlid: hackathon.hlid} : find;

	collection.find(find).sort({time: 1}).toArray(function(err, commits) {
		if(err) { return console.dir(err); }

		if (commits) {
			for (var c in commits) {
				commits[c].elapsed = moment(commits[c].time).diff(moment(hackathon.start), 'minutes');
			}

			res.render('timeline', {
				hackathon: hackathon,
				commits: commits,
				type: 'commits',
				category: 'timeline',
				name: find.repo
			});
		} else {
			res.status(404).end();
		}

		db.close();
	});
};

app.get('/hackathons/:hlid/:type/:category', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if (hackathon) {
				if (req.params.category == 'timeline') {
					timeline(db, hackathon, res);
				} else {
					res.render('hackathon', {
						hackathon: hackathon,
						type: req.params.type,
						category: req.params.category
					});

					db.close();
				}
			} else {
				res.status(404).end();

				db.close();
			}
		});
	});
});

app.get('/hackathons/:hlid/:type/:category/:name', function(req, res) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.dir(err); }
		
		var collection = db.collection('hackathons');
		collection.findOne({hlid: req.params.hlid}, function(err, hackathon) {
			if (hackathon) {
				if (req.params.category == 'timeline') {
					var find = { hlid: req.params.hlid };
					find['repo'] = req.params.name;

					timeline(db, hackathon, res, find);
				} else {
					res.render('hackathon', {
						hackathon: hackathon,
						type: req.params.type,
						category: req.params.category,
						name: req.params.name
					});

					db.close();
				}
			} else {
				res.status(404).end();

				db.close();
			}
		});
	});
});

/* github update */

var checkCommit = function(hlid, owner, repo, commit, end) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
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
		qs: {access_token: settings.access_token}
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
	MongoClient.connect(settings.mongourl, function(err, db) {
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