var request = require('request');
var cheerio = require('cheerio');

var hlBaseUrl = 'http://www.hackerleague.org';
var partsUrl = hlBaseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';
var ghBaseUrl = 'http://www.github.com/'; // needs the slash

// emitter.setMaxListeners(0);

var getGithubUser = function(url) {
	var slash = url.lastIndexOf('/');

	if (slash < url.length - 1) {
		return url.substring(slash + 1);
	}

	return "";
};

var getRepos = function(user) {
	request('https://api.github.com/users/' + user + '/repos?sort=created', function(err, resp, body) {
		console.log(resp);
	});
}

var scrapeUser = function(githubList, userPageUrl) {

	request(userPageUrl, function(err, resp, body){
		var $ = cheerio.load(body);
		// Git Profile Links
		var gitLinks = $('.contact_row > a.github.icon');
		$(gitLinks).each(function(i, gitLink){
			var gitUrl = $(gitLink).attr('href');
			var girUrlPhrases = gitUrl.split("/");
			gitUrl = ghBaseUrl + girUrlPhrases[girUrlPhrases.length-1]
			var ghUser = getGithubUser(gitUrl);

			if (gitUrl != ghBaseUrl) {
				if (githubList.indexOf(ghUser) < 0) {
					githubList.push(ghUser);

					getRepos(ghUser);
				}
			}
		});
	});

};

request(partsUrl, function(err, resp, body){
	var $ = cheerio.load(body);
	var userList = [];
	var githubList = [];

	// User Page Links
	var userLinks = $('div#participants .user > .details > a.username');

	$(userLinks).each(function(i, userLink){

		var userPageUrl = hlBaseUrl + $(userLink).attr('href');

		if (userList.indexOf(userPageUrl) < 0) {
			userList.push(userPageUrl);
			console.log(userPageUrl);
			scrapeUser(githubList, userPageUrl)
		}
	});

});

