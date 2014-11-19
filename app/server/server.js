Meteor.methods({
	fork: function(id) {
		check(id, String);
		var pad = Pads.findOne(id);
		if (!pad)
			throw new Meteor.Error('404', "Can't fork non-existant pad " + id);

		delete(pad._id);
		pad.forkedFrom = id;
		pad.owners = [ this.userId ];
		pad.title = 'Fork of ' + pad.title;
		if (pad.updatedAt)
			delete(pad.updatedAt);
		pad.createdAt = new Date();

		var pages = Pages.find({padId: id}).fetch();

		id = Pads.insert(pad);

		_.each(pages, function(page) {
			delete(page._id);
			page.padId = id;
			Pages.insert(page);
		});

		return id;
	},

	deletePage: function(pageId) {
		check(pageId, String);
		var page = Pages.findOne(pageId);
		if (!page)
			throw new Meteor.Error('404', "Can't delete non-existant page " + pageId);

		Pages.remove(pageId);
		var pad = Pads.findOne(page.padId);
		if (pad.pages == 1) {
			Pads.remove(pad._id);
			return 'deleted';
		}

		Pads.update(page.padId, { $inc: { pages: -1 } });
		Pages.update( { padId: page.padId, pageNo: { $gt: page.pageNo } },
			{ $inc: { pageNo: -1 }});
		// if orig pageNo was less than total pages, stay on current route (since
		// the next page will inherit this pageNo.  Otherwise go to new pages count.
		return page.pageNo < pad.pages ? false/*keepCurrentRoute*/ : pad.pages-1;
	}
});