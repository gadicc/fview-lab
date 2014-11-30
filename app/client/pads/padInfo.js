Template.padInfo.events({
	'keydown #slug': function(event, tpl) {
		var value = $(event.target).val();
		var link = tpl.$('#link');
		link.html('fview-lab.meteor.com/' + Meteor.user().username + '/' + value);
	},
  'click button': function(event, tpl) {
    var team = this;
    var pad = Template.parentData(0).pad;
    Pads.update(pad._id, { $set: { owner: team._id }});
  }
});

Template.padInfo.helpers({
	'padStats': function() {
		return PadStats.findOne(this.pad._id);
	},
  'myTeams': function() {
    return Meteor.users.find({members: Meteor.userId()});
  }
});