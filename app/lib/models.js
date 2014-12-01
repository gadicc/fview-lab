Pads = new Mongo.Collection('pads');
Pages = new Mongo.Collection('pages');
PadStats = new Mongo.Collection('padStats');

// Takes a padId, a pad, or a page
userOwnsPad = function(userId, pad) {
	if (typeof pad === 'object') {
		if (pad.padId && !pad.owner)
		  pad = Pads.findOne(pad.padId);
	} else
			pad = Pads.findOne(pad);
	return !!pad && pad.owner == userId;
};
userCanEditPad = function(userId, pad) {
	if (typeof pad === 'object') {
		if (pad.padId && !pad.owner)
		  pad = Pads.findOne(pad.padId);
	} else
			pad = Pads.findOne(pad);
	if (!pad)
		return false;
	var ok = (pad.owner == userId) ||
		(pad.editors && pad.editors.indexOf(userId) !== -1);
	if (!ok) {
		// only lookup team if we need to
		var owner = Meteor.users.findOne(pad.owner);
		ok = owner && owner.members && owner.members.indexOf(userId) !== -1;
	}
	return ok;
};

var createdAt = function(userId, doc) {
	doc.createdAt = new Date();
};
var updatedAt = function(userId, currentDoc, fieldNames, modifier) {
	if (modifier.$set)
		modifier.$set.updatedAt = new Date();
	else
		modifier.$set = { updatedAt: new Date() };
};

// TODO, disallow user to touch view stats, etc

Pads.allow({
	insert: userOwnsPad,
	update: userCanEditPad,
});

Pages.allow({
	insert: userCanEditPad,
	update: userCanEditPad
});

if (Meteor.isServer) {
	Pads.before.insert(createdAt);
	Pads.before.update(updatedAt);
	Pages.before.insert(createdAt);
	Pages.before.update(updatedAt);

	Pads.after.insert(function(userId, pad) {
		PadStats.insert( {_id: pad._id, siteCounts: [] });
	});

	Pages.before.update(function(userId, currentDoc, fieldNames, modifier) {
		// relies on modifier.$set existing from updatedAt()
		var query = 'url=https%3A%2F%2Ffview-lab.meteor.com%2Fpads%2F' +
    	currentDoc.padId + '&viewport=1200x750' +
    	'&fullpage=true&unique=' + Date.now();
    var token = md5(query + url2png.secret);
		var url = 'https://api.url2png.com/v6/' +
			url2png.api + '/' + token + '/png/?' + query;
		modifier.$set.webshot = url;
	});

	Pages.after.update(function(userId, page, fieldNames, modifier) {
		if (page.pageNo == 1) {
			// code duped in routing.js
      var match = page.guide && marked(page.guide).match(/<p>(.*)<\/p>/);
      var excerpt = page.guide && match ? match[1] :
        'FView Lab, Realtime Famo.us+Meteor Playground';

      var query = 'url=https%3A%2F%2Ffview-lab.meteor.com%2Fembed%2F' +
      	page.padId + '&viewport=600x400&thumbnail_max_width=400' +
      	'&fullpage=true&unique=' + Date.now();
	    var token = md5(query + url2png.secret);
			var url = 'https://api.url2png.com/v6/' +
				url2png.api + '/' + token + '/png/?' + query;
			
			Pads.update(page.padId, { $set: {
				excerpt: excerpt,
				webshot: url
			}});
		}
	}, {fetchPrevious: false});
}

if (Meteor.isServer) {
	Meteor.publish('mypads', function(limit) {
		check(limit, Number);
		return Pads.find({owner: this.userId}, {limit:limit});
	});

	Meteor.publish('myTeams', function() {
		return Meteor.users.find({members: this.userId});
	});

	Meteor.publish('pad', function(id) {
		return Pads.find(id, { limit: 1 });
	});

	Meteor.publish('page', function(padId, pageNo) {
		check(padId, String);
		check(pageNo, Number);
		return Pages.find({
			padId: padId,
			$or: [ { pageNo: pageNo }, { pageNo: pageNo + 1 } ]
		}, { limit: 2 });
	});

	Meteor.publish('padStats', function(id) {
		check(id, String);
		// aggregate not sopported in minimongo yet
		// TODO, aggregate directly with mongo and manually publish
		return PadStats.find({
			_id: id,
		}, { limit: 1, fields: { ipList: 0 } } );
	});

	Meteor.publish('userByName', function(username) {
		return Meteor.users.find({ username: username }, { fields: {
			username: 1,
			profile: 1
		}});
	});
	Meteor.publish('userById', function(id) {
		return Meteor.users.find(id, { fields: {
			username: 1,
			profile: 1
		}});
	});

	Meteor.publish('userPads', function(userId) {
		return Pads.find({owner:userId});
	});

	// Populate initial data
	if (Pads.find().count() == 0) {
		var owner = Meteor.users.findOne();
		if (!owner) return;

		var padId = Pads.insert({
			_id: 'intro',
			title: "Intro to FView Lab",
			pages: 1,
			owner: owner._id
		});

		Pages.insert({
			padId: padId,
			pageNo: 1,
			templates: {
				spacebars:
				'<template name="famousInit">\n' +
				'  {{>StateModifier template="main" origin="[0.5,0.5]" align="[0.5,0.5]" proportions="[0.8,0.8]"}}\n' +
				'</template>\n' +
				'<template name="main">\n' +
				'  {{>Surface template="mySurface" style="background: green;"}}\n' +
				'</template>\n' +
				'<template name="mySurface">\n' +
				'  Hi, {{name}}.<br>\n' +
				'  Obviously typing here just refreshes\n' +
				' the surface content and doesn\'t recreate\n' +
				'  the render tree from scratch.  Duh :)\n' +
				'  Try it out.  Animations will continue;\n' +
				'  Same for helpers: {{name}} {{name}} {{name}}\n' +
				'  <br>\n' +
				'  To restart the animation, modify the "main" template content\n' +
				'  or the Template.main javascript\n' +
				'</template>'
			},
			code: {
				javascript:
				'Template.mySurface.helpers({\n' +
				'  // You can change this too, the animation continues\n' +
				'  name: function() { return "Gadi"; }\n' +
				'});\n' +
				'Template.main.rendered = function() {\n' +
				'  var fview = FView.from(this);\n' +
				'    fview.modifier.setTransform(famous.core.Transform.rotateZ(200));\n' +
				'    fview.modifier.setTransform(famous.core.Transform.rotateZ(-200),\n' +
				'      { duration : 5000, curve: "easeInOut" });\n' +
				'    fview.modifier.setTransform(famous.core.Transform.rotateZ(200),\n' +
				'      { duration : 5000, curve: "easeInOut" });\n' +
				'    fview.modifier.setTransform(famous.core.Transform.rotateZ(0),\n' +
				'      { duration : 5000, curve: "easeInOut" });\n' +
				'};'
			} /* code */
		}); /* insert */
	} /* if pads.count == 0 */
} /* if server */