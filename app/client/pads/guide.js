myTeams = [];
Tracker.autorun(function() {
	var userId = Meteor.userId();
	myTeams = userId &&
		_.pluck(Meteor.users.find({members: userId}).fetch(), '_id');
});

Template.registerHelper('isOwner', function() {
	var userId = Meteor.userId();
  return this.pad && (this.pad.owner == userId ||
  	(this.pad.editors && this.pad.editors.indexOf(userId) !== -1) ||
  	myTeams.indexOf(this.pad.owner) !== -1) ? 'isOwner' : false;
});

Template.guide.helpers({
	guideContent: function() {
		return Session.get('guideDirty') || (this.page && this.page.guide)
			|| 'This page has no guide.';
	},
	multiplePagesOrOwner: function() {
		var userId = Meteor.userId();
		return (this.pad && this.pad.pages > 1) ||
			(this.pad && (this.pad.owner == userId ||
			(this.pad.editors && this.pad.editors.indexOf(userId) !== -1) ||
			myTeams.indexOf(this.pad.owner) !== -1));
	},
  prevPage: function() {
    return this.page && this.page.pageNo > 1 && (this.page.pageNo-1);
  },
  nextPage: function() {
    return this.page && this.page.pageNo < this.pad.pages && (this.page.pageNo+1);
  },
	'embedCode': function() {
		return '<iframe width="100%" height="400px" ' +
			'src="https://fview-lab.meteor.com/embed/' + this.pad._id +
		  '" frameborder="0"></iframe>';
	},
	'showEmbedCode': function() {
		return showEmbedCode.get();
	}
});

ShareIt.configure({
  buttons: 'small'
});

var origShareItRendered = Template.shareit.rendered;
Template.shareit.rendered = function() {
	if (origShareItRendered)
		origShareItRendered.apply(this, arguments);
	var div = this.$('.share-buttons');
	var a = $('<a id="showEmbedCode">Embed</a>');
	div.append(a);
};

Template.guide.events({
	'click button': function(event, tpl) {
		var target = event.currentTarget.getAttribute('data-target');

    if (target !== 'deletePage' && !navigateWithUnsavedWork()) 
      return;

		switch(target) {
			case 'createNext':
				// See also new pad code in header.js:Template.padHeader.events
				Pages.insert({
					padId: tpl.data.pad._id,
					pageNo: tpl.data.page.pageNo+1,
					templates: {},
					code: {}
				});
				Pads.update(tpl.data.pad._id, { $inc: { pages: 1 }} );
				/* no break, continue to "next" */

			case 'next':
				Router.go('padPage', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo+1 });
				break;

			case 'prev':
				Router.go('padPage', { _id: tpl.data.pad._id, pageNo: tpl.data.page.pageNo-1 });
				break;

			case 'deletePage':
				if (confirm('Are you sure you want to delete this page?'))
				Meteor.call('deletePage', tpl.data.page._id, function(error, newPageNo) {
					if (error)
						alert(error);
					else
						if (newPageNo)
							Router.go('padPage', { _id: tpl.data.pad._id, pageNo: newPageNo });
				});
				break;
		}
	},
	'click #guideActions a': function(event, tpl) {
		var action = event.currentTarget.getAttribute('data-action');
		if (action == 'edit')
			Session.set('editGuide', !Session.get('editGuide'));
	},
	'click #showEmbedCode': function(event, tpl) {
		showEmbedCode.set(!showEmbedCode.get());
	},
	'click a': function(event, tpl) {
    if (!navigateWithUnsavedWork()) 
			event.preventDefault();
	}
});

var showEmbedCode = new ReactiveVar();