USER_LIMIT = -1;

var request = require('request');
var cheerio = require('cheerio');

var hlBaseUrl = 'http://www.hackerleague.org';
var partsUrl = hlBaseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';
var ghBaseUrl = 'http://www.github.com/'; // needs the slash

var start = new Date('2013-09-28T18:00Z');

var getGithubUser = function(url) {
	var slash = url.lastIndexOf('/');

	if (slash < url.length - 1) {
		return url.substring(slash + 1);
	}

	return "";
};

var getActivity = function(owner, repo) {
	request.get({
		uri: 'https://api.github.com/repos/' + owner + '/' + repo + '/commits',
		json: true
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			for (var c in body) {
				var commit = body[c];

				var time = new Date(commit.commit.committer.date);

				if (time > start) {
					console.log(time + ' : ' + commit.commit.committer.name);
				}
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting activity from ' + owner + '/' + repo + ': ' + resp.statusCode);
		}
	});
};

var getRepos = function(user) {
	request.get(
		{
			uri: 'https://api.github.com/users/' + user + '/repos?sort=created', 
			json: true
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var repo_hack;

			for (var r in body) {
				var repo = body[r];

				var created_at = new Date(repo.created_at);

				if (created_at > start) {
					repo_hack = repo;
					break;
				}

				break;
			}

			if (repo_hack) {
				getActivity(repo_hack.owner.login, repo_hack.name);
			} else {
				console.log(user + ' has ' + body.length + ' repos but none are recent.');
			}
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error getting repos: ' + resp.statusCode);
		}
	});
};

var scrapeUser = function(githubList, userPageUrl) {

	request(userPageUrl, function(err, resp, body){
		if (!err && resp.statusCode == 200) {
			var $ = cheerio.load(body);
			// Git Profile Links
			var gitLinks = $('.contact_row > a.github.icon');
			$(gitLinks).each(function(i, gitLink) {

				// grab git username
				var gitUrl = $(gitLink).attr('href');
				var gitUrlPhrases = gitUrl.split("/");
				gitUrl = ghBaseUrl + gitUrlPhrases[gitUrlPhrases.length - 1]

				var ghUser = getGithubUser(gitUrl);

				if (gitUrl != ghBaseUrl && githubList.indexOf(ghUser) < 0) {
					githubList.push(ghUser);

					getRepos(ghUser);
				}
			});
		} else if (err) {
			console.error(err.message);
		} else {
			console.error('Error scraping ' + userPageUrl + ' : ' + resp.statusCode);
		}
	});

};

request(partsUrl, function(err, resp, body) {
	var $ = cheerio.load(body);
	var userList = [];
	var githubList = [];

	// User Page Links
	var userLinks = $('div#participants .user > .details > a.username');

	$(userLinks).each(function(i, userLink) {
		if (USER_LIMIT >= 0 && i >= USER_LIMIT) {
			return;
		}

		var userPageUrl = hlBaseUrl + $(userLink).attr('href');

		if (userList.indexOf(userPageUrl) < 0) {
			userList.push(userPageUrl);
			console.log(userPageUrl);
			scrapeUser(githubList, userPageUrl)
		}
	});

});

