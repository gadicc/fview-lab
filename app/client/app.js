var isDevel = Injected.obj('env').NODE_ENV === 'development';

FView.ready(function() {
  famous.polyfills;
  famous.core.famous;

  FView.registerView('GridLayout', famous.views.GridLayout);
  FView.registerView('FlexibleLayout', famous.views.FlexibleLayout);
});

iframe = null;
var iframeSrc = isDevel
  ? 'http://localhost:6020'
  : 'https://fview-lab-sandbox.meteor.com';

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

sandbox = new ReactiveDict();
Template.result.helpers({
  sandbox: {
    jsError: function() { return sandbox.get('jsError'); }
  }
});

function receiveMessage(event) {
  if (event.origin !== iframeSrc || event.data.substr(0,10) !== 'fview-lab ') {
    console.log('ignore', event);
    return;
  }

  var data = JSON.parse(event.data.substr(10));  // strip "fview-lab "

  if (data.type=='setVar')
    sandbox.set(data.name, data.value);
  else
    console.log('Unknown ', data);
}

if (window.addEventListener)
  window.addEventListener('message', receiveMessage, false);
else if (window.attachEvent)
  window.attachEvent('onmessage', receiveMessage, false);
else
  alert("Not sure what browser you're using but we can't use it, sorry.");

Meteor.subscribe('mypads', 5);

// http://stackoverflow.com/questions/22867690/how-do-i-use-x-editable-on-dynamic-fields-in-a-meteor-template-now-with-blaze#23095399
Template.xedit.rendered = function() {
  var container = this.$('*').eq(0);
  this.autorun(function() {
    var value = Blaze.getData().value;
    var elData = container.data();
    if (elData && elData.editable) {
      elData.editable.setValue(value, true);
      // no idea why this is necessary; xeditable bug?
      if (elData.editableContainer)
        elData.editableContainer.formOptions.value = elData.editable.value;
    }
  });
};

var hashSeed = '0xABCD';
hash = function(input) {
  return XXH(input, hashSeed).toString(16);
}

// could keep sorted to optimize :)
insertNoDupes = function(array, value) {
  if (array.indexOf(value) === -1)
    array.push(value);
}
