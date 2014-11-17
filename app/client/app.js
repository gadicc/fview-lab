var isDevel = Injected.obj('env').NODE_ENV === 'development';

FView.ready(function() {
  famous.polyfills;
  famous.core.famous;

  FView.registerView('GridLayout', famous.views.GridLayout);
  FView.registerView('FlexibleLayout', famous.views.FlexibleLayout);
});

iframe = null;
var iframeSrc = isDevel
  ? 'http://localhost:6020/'
  : 'https://fview-lab-sandbox.meteor.com/';

var postQueue = [];
post = function(data) {
  postQueue.push(data);
}

Template.iframe.rendered = function() {
  iframe = this.find('#iframe');
  iframe.onload = function() {
    post = function(data) {
      iframe.contentWindow.postMessage(
        'fview-lab ' + JSON.stringify(data), iframeSrc);
    };

    for (var i=0; i < postQueue.length; i++)
      post(postQueue[i]);
    delete(postQueue);
  };
  iframe.src = iframeSrc;
  //console.log(iframe);
}

function receiveMessage(event) {
  if (event.data.substr(0,10) === 'fview-lab ' || event.origin !== iframeSrc) {
    console.log('ignore', event);
    return;
  }

  var data = JSON.parse(event.data.substr(11));  // strip "fview-lab "
  console.log(data);
}

Template.header.helpers({
  title: function() { return Session.get('title'); },
  isDirty: function() { return Session.get('isDirty'); }
});

Template.header.events({
  'click button[data-action="save"]': function(event, tpl) {
    save();
  }
});

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