committing
==========
Tracks git commits made in publicly-available repositories on [Github](https://github.com) during hackathons on [Hacker League](http://hackerleague.org).


Installation
------------
`committing` runs on `node.js` and mongodb, so set those up first! Then run
```
$ npm update
```

Setup
-----
A github access token is needed to retrieve data from github. Either
* Create an environment variable named `GITHUB` with the access token
* Create file named `secrets.js` with the contents `module.exports.github_access_token = '<access_token>';`

Set up mongodb either by adding a `MONGO` environment variable or editing `settings.js` to match your development settings.

After you set up mongodb, run
```
$ node ./server.js
```
then visit `localhost:8080` in your browser.

To scrape data from Hacker League, visit `localhost:8080/scrape/<hackathon-url>` where `<hackathon-url>` is the corresponding portion of the Hacker League url, such as `hackerleague.org/hackathons/<hackathon-url>`.
The new hackathon should show up on the homepage.

Options
-------
The port can be changed by setting the `PORT` environment variable.
