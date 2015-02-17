UserController = RouteController.extend({
  layoutTemplate: 'layout',
  waitOn: function() {
    return [
      subs.subscribe('userByName', this.params.username)
    ];
  },
  data: function() {
    var user = Meteor.users.findOne({ username: this.params.username });
    if (!user) return null;

    subs.subscribe('userPads', user._id);
    return { user: user }
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

// option to get close to min or max or an optional ideal?
// note, margins/spacing args are for SAME AXIS ONLY
function sweetSpot(total, minSize, maxSize, margins, spacing) {
  // Accomodate margins
  total = total - margins[0] - margins[1];

  // Short cut for if we can only fit 1 item per row
  if (total/2 < minSize)
    return total;

  // add spacing for calculation purposes, but remember to return
  // substract this again before returning an actual itemSize value
  total += spacing;
  minSize += spacing;
  maxSize += spacing;

  var divMin = Math.floor(total / maxSize);

  /*
  var divMax = Math.ceil(total / minSize);
  var options = [], minIndex=0, min=(maxSize-minSize);
  for (var i=0; i < divMax-divMin+1; i++) {
    options[i] = total / (divMin+i);
  }
  console.log(divMin, divMax);
  console.log(options);
  */

  var t = total / divMin;
  if (t < maxSize && t > minSize)
    return t - spacing;
  t = total / (divMin+1);
  return t - spacing;
}

Template.userHome.helpers({
  pads: function() {
    var sortBy = {};
    sortBy[Session.get('sortBy')] = -1;

    return Pads.find(
      { owner: this.user._id },
      { sort: sortBy }
    );
  },
  ctime: function() {
    return moment(this.createdAt).format('YYYY-MM-DD');
  },
  layoutOptions: function() {
    var options = {
      "margins": [20,20,20,20],
      "spacing": [20,20],
    };
    options.itemSize = function(renderNode, size) {
      return [ 
        sweetSpot(size[0], 300, 450,
          [options.margins[0],options.margins[2]], options.spacing[0]),
        155 // height
      ];
    };
    return options;
  }
});

Session.setDefault('sortBy', 'createdAt');

Template.userHomeSort.events({
  'click a': function(event, tpl) {
    var what = event.currentTarget.getAttribute('data-value');
    Session.set('sortBy', what);
  }
});

Template.userHomeSort.helpers({
  sortByClass: function(what) {
    return Session.equals('sortBy', what) ? 'active' : '';
  }
});