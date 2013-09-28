var request = require('request');
var cheerio = require('cheerio');

var baseUrl = 'http://www.hackerleague.org';
var partsUrl = baseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';


var scrapeUser = function(userPageUrl) {

	request(userPageUrl, function(err, resp, body){
		var $ = cheerio.load(body);

		// Git Profile Links
		gitLinks = $('.contact_row > a.github.icon'); 

		$(gitLinks).each(function(i, gitLink){
			var gitUrl = $(gitLink).attr('href');
			console.log(gitUrl);
		});
	});

}

request(partsUrl, function(err, resp, body){
	var $ = cheerio.load(body);
	var userList = [];

	// User Page Links
	userLinks = $('div#participants .user > .details > a.username');

	$(userLinks).each(function(i, userLink){
		var userPageUrl = baseUrl + $(userLink).attr('href');

		if (userList.indexOf(userPageUrl) < 0) {
			userList.push(userPageUrl);

			scrapeUser(userPageUrl)
		}
	});

});

