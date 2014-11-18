Template.registerHelper('isOwner', function() {
  return this.pad && this.pad.owners.indexOf(Meteor.userId()) !== -1 ? 'isOwner' : false;
});

Template.guide.helpers({
	guideContent: function() {
		return Session.get('guideContent') || (this.page && this.page.guide)
			|| 'No guide has been written yet';
	},
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
			Router.go('padPage', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo+1 });
			break;

			case 'prev':
			Router.go('padPage', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo-1 });
			break;
		}
	},
	'click #guideActions a': function(event, tpl) {
		var action = event.currentTarget.getAttribute('data-action');
		if (action == 'edit')
			Session.set('editGuide', !Session.get('editGuide'));
	}
});