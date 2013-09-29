var request = require('request');
var cheerio = require('cheerio');

var hlBaseUrl = 'http://www.hackerleague.org';
var partsUrl = hlBaseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';
var ghBaseUrl = 'http://www.github.com/'; // needs the slash

// emitter.setMaxListeners(0);

var scrapeUser = function(githubList, userPageUrl) {

	request(userPageUrl, function(err, resp, body){
		var $ = cheerio.load(body);

		// Git Profile Links
		var gitLinks = $('.contact_row > a.github.icon');

		$(gitLinks).each(function(i, gitLink){
			var gitUrl = $(gitLink).attr('href');

			if (gitUrl != ghBaseUrl) {
				if (githubList.indexOf(gitUrl) < 0) {
					githubList.push(gitUrl);

					console.log(gitUrl);
				}
			}
		});
	});

}

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

