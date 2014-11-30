// Uh oh, look into this.
//Meteor.AppCache.config({onlineOnly: '/packages/dcsan_reactive-ace/'});

var isDevel = Injected.obj('env').NODE_ENV === 'development';

// for flexiblelayout below, works around timing issues
function flCheck() {
  if (this.children.length === this._ratios.length)
    this.view.setRatios(this._ratios);
  else
    flCheck.bind(this);
}

FView.ready(function() {
  famous.polyfills;
  famous.core.famous;

  FView.registerView('GridLayout', famous.views.GridLayout);
  FView.registerView('FlexibleLayout', famous.views.FlexibleLayout, {
    // doesn't handle adding children after setting ratios
    famousCreatedPost: function() {
      var view = this.view;
      this._ratios = view._ratios.get();
      view.setRatios([]);
      famous.core.Engine.nextTick(flCheck.bind(this));
    }
  });
});

iframe = null, $iframe = null;
var iframeSrc = isDevel
  ? 'http://localhost:6020'
  : 'https://fview-lab-sandbox.meteor.com';

var postQueue = [];
post = function(data) {
  if (iframe && iframe.contentWindow && iframe.loaded)
    iframe.contentWindow.postMessage('fview-lab ' +
      JSON.stringify(data), iframeSrc);
  else
    postQueue.push(data);
}

Template.iframe.rendered = function() {
  $iframe = this.$('#iframe');
  iframe = $iframe[0];  // used globally!

  iframe.onload = function() {
    // work around Apple completely screwing up how HTML works
    var surface = FView.byId('iframe').surface;
    var size = surface.getSize();
    $iframe.width(size[0]);
    $iframe.height(size[1]);

    surface.on('resize', function() {
      var size = surface.getSize();
      $iframe.width(size[0]);
      $iframe.height(size[1]);
    });

    iframe.loaded = true;
    for (var i=0; i < postQueue.length; i++)
      post(postQueue[i]);
    postQueue = [];
  };
  iframe.src = iframeSrc;
}

sandbox = new ReactiveDict();
Template.result.helpers({
  sandbox: {
    jsError: function() {
      var error = sandbox.get('jsError');
      return error ? error.message+'\n'+error.stack.join('\n') : null;
    }
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
  else if (data.type=='cheese') {
    var div = document.createElement('div');
    div.id = 'url2png-cheese';
    document.body.appendChild(div);
  } else if (receiveHandlers[data.type])
    receiveHandlers[data.type](data.data || data);
  else
    console.log('Unknown ', data);
}
if (typeof receiveHandlers === 'undefined')
  receiveHandlers = {};

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
};

// could keep sorted to optimize :)
insertNoDupes = function(array, value) {
  if (array.indexOf(value) === -1)
    array.push(value);
};

Template.padLayout.overlay = function() {
  return Session.get('overlay');
};
