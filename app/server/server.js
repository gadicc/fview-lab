Meteor.methods({
	'fork': function(id) {
		var pad = Pads.findOne(id);
		if (!pad)
			throw new Meteor.Error('404', "Can't fork non-existant pad " + id);

		delete(pad._id);
		pad.forkedFrom = id;
		pad.owners = [ this.userId ];
		pad.title = 'Fork of ' + pad.title;

		var pages = Pages.find({padId: id}).fetch();

		id = Pads.insert(pad);

		_.each(pages, function(page) {
			delete(page._id);
			page.padId = id;
			Pages.insert(page);
		});

		return id;
	}
});