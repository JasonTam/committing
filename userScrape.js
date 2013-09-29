USER_LIMIT = -1;

var request = require('request');
var cheerio = require('cheerio');
var MongoClient = require('mongodb').MongoClient;

var hlBaseUrl = 'http://www.hackerleague.org';
var partsUrl = hlBaseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';
var ghBaseUrl = 'http://www.github.com/'; // needs the slash

var start = new Date('2013-09-28T18:00Z');

/* GITHUB */
var access_token = "9b73db13aedb532621c2318d0bc5c5d6955a4805";

/* MONGODB */
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

var getGithubUser = function(url) {
	var slash = url.lastIndexOf('/');

	if (slash < url.length - 1) {
		return url.substring(slash + 1);
	}

	return "";
};

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

			// console.log(repo + ',' + body.commit.committer.name + ',' + net_lines + ',' + time.toISOString());

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

var getActivity = function(owner, repo) {
	// console.log(repo);

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
					getCommitDetail(owner, repo, commit.sha);
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
	var uri = 'https://api.github.com/users/' + user + '/repos?sort=pushed';

	request.get({
		uri: uri, 
		json: true,
		qs: {access_token: access_token}
	}, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var repo_hack;

			for (var r in body) {
				var repo = body[r];

				// var created_at = new Date(repo.created_at);

				// if (created_at > start) {
				// 	repo_hack = repo;
				// 	break;
				// }

				repo_hack = repo;

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
			console.error('Error getting repos from ' + uri + ' : ' + resp.statusCode);
		}
	});
};

var crawlRepos = function(gitUrl){
	request(gitUrl,function(err,resp,body){
		var $ = cheerio.load(body);
		var repoCLink = $('.simple-conversation-list>li .title');
		var repoLink=$(repoCLink).attr('href')
		console.log(repoLink);
	})
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
					// crawlRepos(gitUrl)
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

var scrape = function() {
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

			// if (userPageUrl != 'http://www.hackerleague.org/users/jtam' &&
			// 	userPageUrl != 'http://www.hackerleague.org/users/csherland')
			// 	return;

			if (userList.indexOf(userPageUrl) < 0) {
				userList.push(userPageUrl);
				// console.log(userPageUrl);
				scrapeUser(githubList, userPageUrl)
			}
		});

	});
};

module.exports = scrape;

