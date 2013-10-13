var request = require('request');
var cheerio = require('cheerio');
var MongoClient = require('mongodb').MongoClient;

var hlBaseUrl = 'http://www.hackerleague.org';
var participationUrl = '/participations';
var ghBaseUrl = 'http://www.github.com/'; // needs the slash

/* GITHUB */
var access_token;

if (process.env.NODE_ENV == 'production') {
	access_token = process.env.GITHUB;
} else {
	var secrets = require('./secrets.js');
	access_token = secrets.github_access_token;
}

/* MONGODB */
var mongo;
var mongourl;

var generate_mongo_url = function(obj) {
	obj.hostname = (obj.hostname || 'localhost');
	obj.port = (obj.port || 27017);
	obj.db = (obj.db || 'powerdata');
	

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

// local database for development
var mongo = {
	'hostname' : 'localhost',
	'port' : 27017,
	'username' : '',
	'password' : '',
	'name' : '',
	'db' : 'committing'
};

var mongourl = generate_mongo_url(mongo);

var getGithubUser = function(url) {
	var slash = url.lastIndexOf('/');

	if (slash < url.length - 1) {
		return url.substring(slash + 1);
	}

	return '';
};

var insertHackathon = function(hlid, name, start, end, url) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection('hackathons', function(err, collection) {
			
			collection.ensureIndex('hackathon', function() {
				/* Note the _id has been created */
				collection.insert({
					hlid: hlid,
					name: name,
					start: start,
					end: end,
					url: url
				}, {
					safe : true
				}, function(err, result) {
					if (err) console.warn(err.message);
				});
				
				db.close();
			});
		});
	});
}

var insertCommit = function(data) {
	/* Connect to the DB and auth */
	MongoClient.connect(mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection('commits', function(err, collection) {
			
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

var getCommitDetail = function(hlid, owner, repo, sha, end) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits/' + sha,
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var time = new Date(body.commit.committer.date);

			var file_additions = 0;
			var file_deletions = 0;

			if (body.files) {
				for (var f in body.files) {
					if (body.files[f].status == 'added') {
						file_additions += 1;
					} else if (body.files[f].status == 'removed') {
						file_deletions += 1;
					}
				}
			}

			insertCommit({
				time: time,
				repo: repo,
				owner: owner,
				name: body.commit.committer.name,
				committer: body.committer ? body.committer.login : undefined,
				username: body.author ? body.author.login : undefined,
				additions: body.stats.additions,
				deletions: body.stats.deletions,
				file_additions: file_additions,
				file_deletions: file_deletions,
				message: body.commit.message,
				sha: sha,
				end: end,
				hlid: hlid
			});

		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting commit from ' + owner + '/' + repo + ': ' + resp.statusCode);
		}
	});
}

var getActivity = function(hlid, start, end, owner, repo) {
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
					getCommitDetail(hlid, owner, repo, commit.sha, end);
				}
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting activity from ' + url + ' : ' + resp.statusCode);
		}
	});
};

var getRepos = function(hlid, start, end, user) {
	var uri = 'https://api.github.com/users/' + user + '/repos?sort=created';

	var end_plus = new Date(end.getTime() + 12 * 60 * 60 * 1000);

	request.get({
		uri: uri, 
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var repo_hack;

			for (var r in body) {
				var repo = body[r];

				var pushed_at = new Date(repo.pushed_at);
				var created_at = new Date(repo.created_at);

				// must be created during hackathon
				// must be a push after creation (to avoid forks)
				// and must have code
				if (created_at >= start && created_at < end && pushed_at >= created_at && repo.size > 0) {
					repo_hack = repo;
					break;
				}
			}

			if (!repo_hack) {
				for (var r in body) {
					var repo = body[r];

					var pushed_at = new Date(repo.pushed_at);

					if (pushed_at >= start && pushed_at < end_plus && repo.size > 0) {
						repo_hack = repo;
						break;
					}
				}
			}

			if (repo_hack) {
				console.log(user + ' created ' + repo_hack.name + ' during ' + hlid);

				getActivity(hlid, start, end, repo_hack.owner.login, repo_hack.name);
			} else {
				// console.log(user + ' has ' + body.length + ' repos but none are during ' + hlid);
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting repos from ' + uri + ' : ' + resp.statusCode);
		}
	});
};

var scrapeUser = function(hlid, start, end, githubList, userPageUrl) {

	request(userPageUrl, function(err, resp, body){
		if (!err && resp.statusCode == 200) {
			var $ = cheerio.load(body);
			// Git Profile Links
			var gitLinks = $('.contact_row > a.github.icon');
			$(gitLinks).each(function(i, gitLink) {

				// grab git username
				var gitUrl = $(gitLink).attr('href');
				var gitUrlPhrases = gitUrl.split('/');
				gitUrl = ghBaseUrl + gitUrlPhrases[gitUrlPhrases.length - 1]

				var ghUser = getGithubUser(gitUrl);

				if (gitUrl != ghBaseUrl && githubList.indexOf(ghUser) < 0) {
					githubList.push(ghUser);
					// crawlRepos(gitUrl)
					getRepos(hlid, start, end, ghUser);
				}
			});
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error scraping ' + userPageUrl + ' : ' + resp.statusCode);
		}
	});

};

var scrape = function(url) {
	request(url, function(err, resp, body) {
		var $ = cheerio.load(body);
		var userList = [];
		var githubList = [];

		// get url
		var url = $('meta[property="og:url"]').attr('content');

		// get hackathon dates
		var dates = $('#hackathon_header span.hackathon_utc.hackathon_date');

		var start = new Date(parseInt(dates.attr('data-start'), 10) * 1000);
		var end = new Date(parseInt(dates.attr('data-end'), 10) * 1000);

		// get name
		var name = $('#hackathon_header h1.inline').text().trim();

		if (!name) {
			console.error('Could not retrieve name for ' + url);
			return;
		}

		// get id
		var hlid = $('#main > div:first-child').attr('id');

		if (!hlid) {
			console.error('Could not retrieve hlid for ' + url);
			return;
		}

		insertHackathon(hlid, name, start, end, url);

		// User Page Links
		var userLinks = $('div#participants .user > .details > a.username');

		$(userLinks).each(function(i, userLink) {
			var userPageUrl = hlBaseUrl + $(userLink).attr('href');

			if (userList.indexOf(userPageUrl) < 0) {
				userList.push(userPageUrl);
				scrapeUser(hlid, start, end, githubList, userPageUrl)
			}
		});
	});
};

module.exports.scrapeUrl = scrape;
module.exports.storeCommit = getCommitDetail;