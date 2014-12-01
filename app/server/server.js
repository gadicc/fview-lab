AccountsExtra.init({
	saveCreatedAt: true,
	saveProfilePic: true,
	saveServiceUsername: true,
	setAccountUsername: true
});

Meteor.methods({
	log: function(anything) {
		console.log(anything);
	},

	fork: function(id, pageNo, dirtyContent) {
		check(id, String);
		var pad = Pads.findOne(id);
		if (!pad)
			throw new Meteor.Error('404', "Can't fork non-existant pad " + id);

		delete(pad._id);
		pad.forkedFrom = id;
		pad.owner = this.userId;
		pad.title = 'Fork of ' + pad.title;
		if (pad.updatedAt)
			delete(pad.updatedAt);
		pad.createdAt = new Date();

		var pages = Pages.find({padId: id}).fetch();

		id = Pads.insert(pad);

		_.each(pages, function(page) {
			delete(page._id);
			page.padId = id;

			if (page.pageNo == pageNo) {
				for (var key in dirtyContent) {
					var parts = key.split('.');
					if (parts.length == 1)
						page[key] = dirtyContent[key];
					else if (parts.length == 2)
						page[parts[0]][parts[1]] = dirtyContent[key];
					else
						throw new Error("Can't handle multiple dots in dirty fork update");
				}
			}

			Pages.insert(page);
		});

		return id;
	},

	deletePage: function(pageId) {
		check(pageId, String);
		var page = Pages.findOne(pageId);
		if (!page)
			throw new Meteor.Error('404', "Can't delete non-existant page " + pageId);

		var pad = Pads.findOne(page.padId);
		if (!userCanEditPad(this.userId, pad))
			throw new Meteor.Error('403', "Access denied");

		Pages.remove(pageId);
		if (pad.pages === 1) {
			Pads.remove(pad._id);
			return 'deleted';
		}

		Pads.update(pad._id, { $inc: { pages: -1 } });
		Pages.update( { padId: pad._id, pageNo: { $gt: page.pageNo } },
			{ $inc: { pageNo: -1 }});
		// if orig pageNo was less than total pages, stay on current route (since
		// the next page will inherit this pageNo.  Otherwise go to new pages count.
		return page.pageNo < pad.pages ? false/*keepCurrentRoute*/ : pad.pages-1;
	},

	routeView: function(url) {
		this.unblock();
		
		// track page views
		// for logged in users, track viewed pads, maxpage, lastviewdate
		check(url, String);
		url = url.split('/');

		if (url[1] === 'pads') {
			var pad = Pads.findOne(url[2]);
		} else {
			// /username/slug
		}

		if (!pad)
			return;

		var pageNo = url[3] || '1';

		var query;

		query = { $inc: {} };
		query.$inc['pages.p'+pageNo+'.views'] = 1;
		PadStats.update(pad._id, query);

		// need a better way to do this since it's not stored sorted
		// addToSet doesn't sort either.  index i guess.
		var ip = inet_aton(this.connection.clientAddress);
		PadStats._collection.update(
			{ _id: pad._id, ipList: { $ne: ip } },
			{ $push: { ipList: ip }, $inc: { ipCount: 1 }	}
		);


		// keep track of what the user has viewed, up view & unique view count
		//var userViews = Meteor.users.findOne(this.userId);
		// XXX
	}
});

/*
// once off, done
Meteor.users.find({username:{$exists:false}}).forEach(function(user) {
	var username;
	if (user.services && user.services.github)
		username = user.services.github.username;
	if (!username && user.emails && user.emails.length)
		username = user.emails[0].address.split('@', 1)[0];
	if (!username) {
		console.log("not sure what to do with ", user);
		return;
	}
	AccountsExtra.setUserName(user, username);
	Meteor.users.update(user._id, { $set: { username: user.username }});
	console.log('set ' + user.username);
});
*/

// Listen to incoming HTTP requests, can only be used on the server
WebApp.connectHandlers.use(function(req, res, next) {
	var parts = req.url.split('/').slice(1);
	if (parts.length < 2)
		return next();

	var pad;
	if (parts[0] === 'pads' || parts[0] === 'embed')
		pad = Pads.findOne(parts[1]);
	// else if USER
	else
		return next();

	if (!pad)
		return next();

	if (!(req.headers && req.headers.referer))
		return next();

	var host = req.headers.referer.match(/^https?:\/\/([^\/]+)\//);
	if (host && host.length > 1)
		host = host[1].split(':', 1)[0].toLowerCase().replace(/^www/, '');

	PadStats.update({ id: pad._id, siteCounts: {$elemMatch: { host: host }} },
		{ $inc: { "siteCounts.$.count": 1 } });

	next();
});

// once off (can remove after next deploy)
Pads.find({owners:{$exists:true}}).forEach(function(pad) {
  Pads.update(pad._id, {
    $set: { owner: pad.owners[0], editors: pad.owners.slice(1) },
    $unset: { owners: 1 }
  });
});

if (!Meteor.users.findOne({username:'fview-team'})) {
	var members = Meteor.users.find({username: { $in: ['dragon', 'PEM--', 'gadicc']}}).fetch();
	Meteor.users.insert({
		createdAt: new Date(),
		username: 'fview-team',
		isTeam: true,
		members: _.pluck(members, '_id')
	});
}
