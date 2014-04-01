var request = require('request');
var cheerio = require('cheerio');
var settings = require('./settings.js');
var MongoClient = require('mongodb').MongoClient;

var getGithubUser = function(url) {
	var slash = url.lastIndexOf('/');

	if (slash < url.length - 1) {
		return url.substring(slash + 1);
	}

	return '';
};

var insertHackathon = function(hlid, name, start, end, url) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection('hackathons', function(err, collection) {
			
			collection.ensureIndex('hackathon', function() {
				/* Note the _id has been created */
				collection.update({
					hlid: hlid,
				}, {
					hlid: hlid,
					name: name,
					start: start,
					end: end,
					url: url
				}, {
					upsert: true,
					safe: true
				}, function(err, result) {
					if (err) {
						console.warn(err.message);
					}

					db.close();
				});
			});
		});
	});
}

var insertCommit = function(data) {
	/* Connect to the DB and auth */
	MongoClient.connect(settings.mongourl, function(err, db) {
		if(err) { return console.warn(err); }
		
		db.collection('commits', function(err, collection) {
			
			collection.ensureIndex('time', function() {
				// console.log(data);

				/* Note the _id has been created */
				collection.insert(data, {
					safe : true
				}, function(err, result) {
					if (err) console.warn(err.message);

					db.close();
				});
			});
		});
	});
}

var getCommitDetail = function(hlid, owner, repo, sha, end) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits/' + sha,
		headers: {
			'User-Agent': settings.useragent
		},
		json: true,
		qs: {access_token: settings.access_token}
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
		headers: {
			'User-Agent': settings.useragent
		},
		json: true,
		qs: {access_token: settings.access_token,
			since: start.toISOString(),
			until: end.toISOString()
		}
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
		headers: {
			'User-Agent': settings.useragent
		},
		json: true,
		qs: {access_token: settings.access_token}
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
				gitUrl = settings.ghBaseUrl + gitUrlPhrases[gitUrlPhrases.length - 1]

				var ghUser = getGithubUser(gitUrl);

				if (gitUrl != settings.ghBaseUrl && githubList.indexOf(ghUser) < 0) {
					githubList.push(ghUser);
					// crawlRepos(gitUrl)
					getRepos(hlid, start, end, ghUser);
				}
			});
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error scraping ' + userPageUrl + ' : ' + resp.statusCode);
			console.log(resp.headers);
			console.log(body);
		}
	});

};

var searchProject = function(hlid, start, end, title) {
	var url = 'https://api.github.com/search/repositories';

	request({
		uri: url,
		json: true,
		headers: {
			'User-Agent': settings.useragent
		},
		qs: {access_token: settings.access_token,
			q: title,
			sort: 'updated',
			order: 'desc'}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var repo = body.items[0];

			if (repo) {
				var pushed_at = new Date(repo.pushed_at);
				var created_at = new Date(repo.created_at);

				if (created_at >= start && created_at < end && pushed_at >= created_at && repo.size > 0) {
					getActivity(hlid, start, end, repo.owner.login, repo.name);
				}
			} else {
				console.warn('No repo found for ' + title);
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error searching ' + url + ' : ' + resp.statusCode);
			console.log(resp.headers);
			console.log(body);
		}
	});
}

var scrape = function(hackathon) {
	var partUrl = settings.hlBaseUrl + '/hackathons/' + hackathon + settings.participationUrl;

	request(partUrl, function(err, resp, body) {
		var $ = cheerio.load(body);
		var userList = [];
		var githubList = [];

		// get url
		var userurl = $('meta[property="og:url"]').attr('content');

		// get hackathon dates
		var dates = $('#hackathon_header span.hackathon_utc.hackathon_date');

		var start = new Date(parseInt(dates.attr('data-start'), 10) * 1000);
		var end = new Date(parseInt(dates.attr('data-end'), 10) * 1000);

		// get name
		var name = $('#hackathon_header h1.inline').text().trim();

		if (!name) {
			console.error('Could not retrieve name for ' + userurl + ' from ' + partUrl);
			return;
		}

		// get id
		var hlid = $('#main > div:first-child').attr('id');

		if (!hlid) {
			console.error('Could not retrieve hlid for ' + userurl + ' from ' + partUrl);
			return;
		}

		insertHackathon(hlid, name, start, end, userurl);

		// User Page Links
		var userLinks = $('div#participants .user > .details > a.username');

		$(userLinks).each(function(i, userLink) {
			var userPageUrl = settings.hlBaseUrl + $(userLink).attr('href');

			if (userList.indexOf(userPageUrl) < 0) {
				userList.push(userPageUrl);
				scrapeUser(hlid, start, end, githubList, userPageUrl)
			}
		});
	});

	var projUrl = settings.hlBaseUrl + '/hackathons/' + hackathon + '/hacks';

	request(projUrl, function(err, resp, body) {
		var $ = cheerio.load(body);
		var userList = [];
		var githubList = [];

		// get url
		var userurl = $('meta[property="og:url"]').attr('content');

		// get hackathon dates
		var dates = $('#hackathon_header span.hackathon_utc.hackathon_date');

		var start = new Date(parseInt(dates.attr('data-start'), 10) * 1000);
		var end = new Date(parseInt(dates.attr('data-end'), 10) * 1000);

		// get name
		var name = $('#hackathon_header h1.inline').text().trim();

		if (!name) {
			console.error('Could not retrieve name for ' + userurl + ' from ' + partUrl);
			return;
		}

		// get id
		var hlid = $('#main > div:first-child').attr('id');

		if (!hlid) {
			console.error('Could not retrieve hlid for ' + userurl + ' from ' + partUrl);
			return;
		}

		// User Page Links
		var projLinks = $('div#pitch_teams > div.hack h2.inline a.invert');

		var num = 0;
		$(projLinks).each(function(i, projLink) {
			var projTitle = $(projLink).text();

			if (projTitle.indexOf(' ') < 0) {
				setTimeout(function() {
					searchProject(hlid, start, end, projTitle);
				}, num * 5000);

				num += 1;
			}
		});
	});
};

module.exports.scrape = scrape;
module.exports.storeCommit = getCommitDetail;