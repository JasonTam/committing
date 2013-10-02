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
After you set up mongodb, run
```
$ node ./server.js
```
then visit `localhost:8080` in your browser.

To scrape data from Hacker League, visit `localhost:8080/<hackathon-url>` where `<hackathon-url>` is the corresponding portion of the Hacker League url, such as `hackerleague.org/hackathons/<hackathon-url>`.
The new hackathon should show up on the homepage.
