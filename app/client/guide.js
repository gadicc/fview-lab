Template.registerHelper('isOwner', function() {
  return this.pad && this.pad.owners.indexOf(Meteor.userId()) !== -1;
});

Template.guide.helpers({
  prevPage: function() {
    return this.page && this.page.pageNo > 1 && (this.page.pageNo-1);
  },
  nextPage: function() {
    return this.page && this.page.pageNo < this.pad.pages && (this.page.pageNo+1);
  }
});

Template.guide.events({
	'click button': function(event, tpl) {
		var target = event.currentTarget.getAttribute('data-target');

		switch(target) {
			case 'createNext':
			/* no break, continue to "next" */
			Pages.insert({
				padId: tpl.data.pad._id,
				pageNo: tpl.data.page.pageNo+1,
				templates: {},
				code: {}
			});
			Pads.update(tpl.data.pad._id, { $inc: { pages: 1 }} );

			case 'next':
			Router.go('pads', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo+1 });
			break;

			case 'prev':
			Router.go('pads', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo-1 });
			break;
		}
	}
});