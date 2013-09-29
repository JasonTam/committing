var request = require('request');
var cheerio = require('cheerio');

var baseUrl = 'http://www.hackerleague.org';
var partsUrl = baseUrl + '/hackathons/fall-2013-hackny-student-hackathon/participations';


var scrapeUser = function() {

};

request(partsUrl, function(err, resp, body){
  $ = cheerio.load(body);
  console.log($)
  //User Page Links
/*   userLinks = $('.user a'); 
  $(userLinks).each(function(i, userLink){
	var userPageUrl = baseUrl + $(userLink).attr('href');
	console.log(userPageUrl);
	scrapeUser(userPageUrl)
  }); */

});

