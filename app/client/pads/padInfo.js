Template.padInfo.events({
	'keydown #slug': function(event, tpl) {
		var value = $(event.target).val();
		var link = tpl.$('#link');
		link.html('fview-lab.meteor.com/' + Meteor.user().username + '/' + value);
	}
});

Template.padInfo.helpers({
	'padStats': function() {
		return PadStats.findOne(this.pad._id);
	}
});