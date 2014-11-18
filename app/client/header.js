Template.header.helpers({
  pageHint: function() {
    return this.pad && this.page && this.pad.pages > 1
      ? ' ('+this.page.pageNo+'/'+this.pad.pages+')' : '';
  },
  isDirty: function() { return Session.get('isDirty'); },
  userPads: function() {
    return Pads.find({
      _id: { $not: this.pad._id },
      owners: Meteor.userId()
    });
  }
});

Template.header.events({
  'click button[data-action="save"]': function(event, tpl) {
    save();
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

Template.header.rendered = function() {
  if(this.data.pad.owners.indexOf(Meteor.userId()) !== -1)
  this.$('.title a').editable({
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
  Pages.update(data.page._id, { $set: {
    'templates.spacebars': tplEditor._editor.getValue(),
    'code.javascript': codeEditor._editor.getValue()
  }});
  Session.set('isDirty', false);
}