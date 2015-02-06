Template.padHeader.helpers({
  pageHint: function() {
    return this.pad && this.page && this.pad.pages > 1
      ? ' ('+this.page.pageNo+'/'+this.pad.pages+')' : '';
  },
  isDirty: function() { return Session.get('isDirty'); },
  userPads: function() {
    var userId = Meteor.userId();
    if (!userId) return;
    var query = { owner: userId };
    if (this.pad)
      query._id = { $not: this.pad._id };
    return Pads.find(query);
  },
  padInfoActive: function() {
    return Session.get('showpadInfo') ? 'active' : '';
  }
});

Template.padHeader.events({
  'click #padInfoIcon': function(event, tpl) {
    var state = !Session.get('showpadInfo');
    Session.set('showpadInfo', state);
    Session.set('overlay', state);
    if (state)
      Router.current().render('padInfo', { to: 'overlay'} );
  },
  'click button[data-action="save"]': function(event, tpl) {
    save();
  },
  'click button[data-action="fork"]': function(event, tpl) {
    var $btn = $(event.target);
    $btn.attr('disabled', true);
    $btn.html('Forking...');

    Meteor.call('fork', this.pad._id, this.page.pageNo, dirtyContent(),
      function(error, padId) {
        if (error)
          alert(error);
        else {
          $btn.attr('disabled', false);
          $btn.html('Fork');
          Router.go('padHome', {_id: padId });
        }
      }
    );
  },
  'click a.pads': function(event, tpl) {
    if (!navigateWithUnsavedWork()) {
      event.preventDefault();
      return;
    }

    var action = event.currentTarget.getAttribute('data-action');
    switch(action) {
      case 'new':
        var name = 'Unnamed Pad';
        var lastUnnamed = _.map(_.pluck(
          Pads.find({ title: /^Unnamed Pad/ }, { fields: { title: 1 } }).fetch(),
          'title'), function(name) { return parseInt(name.split(" ")[2]) || 1  })
          .sort().pop();
        if (lastUnnamed)
          name += ' ' + (lastUnnamed+1);

        var padId = Pads.insert({
          title: name,
          owner: Meteor.userId(),
          pages: 1
        });
        Pages.insert({
          padId: padId,
          pageNo: 1,
          code: { },
          templates: { }
        });
        Router.go('padHome', {_id: padId });
        break;

      default:
    }
  }
});

Template.titleEditable.rendered = function() {
  this.$('a').editable({
    mode: 'inline',
    success: function(response, newValue) {
      var padId = this.getAttribute('data-padid');
      Pads.update(padId, { $set: { title: newValue }});
    }
  });
};

$(window).bind('keydown', function(event) {
  if (event.ctrlKey || event.metaKey) {
    switch (String.fromCharCode(event.which).toLowerCase()) {
      case 's':
        event.preventDefault();
        save();
    }
  }
});

// used by save and fork
var dirtyContent = function() {
  var update = {};
  var content;

  if ((content = Session.get('tplDirty')) !== false) {
    update['templates.'+Session.get('tplLang')] = content;
    Session.set('tplDirty', false);
  }

  if ((content = Session.get('codeDirty')) !== false) {
    update['code.'+Session.get('codeLang')] = content;
    Session.set('codeDirty', false);
  }

  if ((content = Session.get('styleDirty')) !== false) {
    update['style.css'] = content;
    Session.set('styleDirty', false);
  }

  if ((content = Session.get('guideDirty')) !== false) {
    update.guide = content;
    Session.set('guideDirty', false);
  }

  return update;
};

var save = function() {
  var data = Router.current().data();
  if (!userCanEditPad(Meteor.userId(), data.pad)) {
    alert("Can't save a pad you don't own!");
    return;
  }

  Pages.update(data.page._id, { $set: dirtyContent() });
  Session.set('isDirty', false);
};
