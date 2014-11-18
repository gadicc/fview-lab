Pads = new Mongo.Collection('pads');
Pages = new Mongo.Collection('pages');

// Takes a padId, a pad, or a page
userOwnsPad = function(userId, pad) {
	if (typeof pad === 'object') {
		if (pad.padId && !pad.owners)
		  pad = Pads.findOne(pad.padId);
	} else
			pad = Pads.findOne(pad);
	return !!pad && pad.owners.indexOf(userId) !== -1;
}

// TODO, disallow user to touch view stats, etc

Pads.allow({
	insert: userOwnsPad,
	update: userOwnsPad
});

Pages.allow({
	insert: userOwnsPad,
	update: userOwnsPad
});

if (Meteor.isServer) {
	Meteor.publish('mypads', function(limit) {
		check(limit, Number);
		return Pads.find({owners: this.userId}, {limit:limit});
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

	// Populate initial data
	if (Pads.find().count() == 0) {
		var owner = Meteor.users.findOne();
		if (!owner) return;

		var padId = Pads.insert({
			_id: 'intro',
			title: "Intro to FView Lab",
			pages: 1,
			owners: [ owner._id ]
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