Template.header.helpers({
  pageHint: function() {
    return this.pad && this.page && this.pad.pages > 1
      ? ' ('+this.page.pageNo+'/'+this.pad.pages+')' : '';
  },
  isDirty: function() { return Session.get('isDirty'); },
  userPads: function() {
    return Meteor.userId() && this.pad && Pads.find({
      _id: { $not: this.pad._id },
      owners: Meteor.userId()
    });
  }
});

Template.header.events({
  'click button[data-action="save"]': function(event, tpl) {
    save();
  },
  'click button[data-action="fork"]': function(event, tpl) {
    var $btn = $(event.target);
    $btn.attr('disabled', true);
    $btn.html('Forking...');

    Meteor.call('fork', this.pad._id, function(error, padId) {
      if (error)
        alert(error);
      else {
        $btn.attr('disabled', false);
        $btn.html('Fork');
        Router.go('padHome', {_id: padId });
      }
    });
  },
  'click a.pads': function(event, tpl) {
    var action = event.currentTarget.getAttribute('data-action');
    switch(action) {
      case 'new':
        if (Session.get('isDirty'))
          if (!confirm('Unsaved work will be lost.  Are you sure?'))
            return;
        var padId = Pads.insert({
          title: 'Unnamed Pad',
          owners: [ Meteor.userId() ],
          pages: 1
        });
        Pages.insert({
          padId: padId,
          pageNo: 1,
          code: { javascript: '' },
          templates: { spacebars: '' }
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

save = function() {
  var data = Router.current().data();
  var update = {
    'templates.spacebars': tplEditor._editor.getValue(),
    'code.javascript': codeEditor._editor.getValue()
  };
  var guideContent = Session.get('guideContent');
  if (guideContent) {
    update.guide = guideContent;
    Session.set('guideContent', null);
  }

  Pages.update(data.page._id, { $set: update });
  Session.set('isDirty', false);
};
