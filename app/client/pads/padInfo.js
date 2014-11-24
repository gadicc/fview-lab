Template.padInfo.events({
	'keydown #slug': function(event, tpl) {
		var value = $(event.target).val();
		var link = tpl.$('#link');
		link.html('fview-lab.meteor.com/' + Meteor.user().username + '/' + value);
	}
});

Template.padInfo.helpers({
	'embedCode': function() {
		return '<iframe width="100%" height="400px" ' +
			'src="https://fview-lab.meteor.com/embed/' + this.pad._id +
		  '" frameborder="0"></iframe>';
	},
	'padStats': function() {
		return PadStats.findOne(this.pad._id);
	}
});