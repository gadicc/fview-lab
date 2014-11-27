UserController = RouteController.extend({
  layoutTemplate: 'layout',
  waitOn: function() {
    return [
      subs.subscribe('userByName', this.params.username)
    ];
  },
  data: function() {
    var user = Meteor.users.findOne({ username: this.params.username });
    console.log(this.params.username, user);
    if (!user) return null;

    subs.subscribe('userPads', user._id);

    return {
      user: user,
      pads: Pads.find({owners: user._id})
    }
  },
  yieldRegions: {
    'userHeader': { to: 'header' },
  }
});

Router.route('/:username', {
  name: 'userHome',
  controller: 'UserController',
  template: 'userHome'
});

Template.userHeader.helpers({
	x: function() {
		console.log(this);
	}
});
