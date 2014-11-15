var isDevel = Injected.obj('env').NODE_ENV === 'development';
var allowOrigin = isDevel
  ? 'http://localhost:6010'
  : 'https://fview-lab.meteor.com';

function receiveMessage(event) {
  if (event.origin !== allowOrigin || event.data.substr(0,10) !== 'fview-lab ') {
    // event.source == window.parent
    console.log('ignore', event);
    return;
  }

  var data = JSON.parse(event.data.substr(10));
  if (typeof data === 'object' && data.type && receiveHandlers[data.type])
    receiveHandlers[data.type](data.data || data);
}

templates = {};
var readies = new ReactiveDict();

var receiveHandlers = {};

receiveHandlers.template = function(data) {
  var name = data.name;
  var tpl = templates[name];

  if (!tpl) {
    tpl = templates[name] = {
      name: name,
      dep: new Tracker.Dependency
    };
    tpl.template = new Template(name, (function(tpl) { return function() {
      tpl.dep.depend();
      // console.log('Redrawing ' + tpl.name);
      view = this;  // set global for this eval gen'd call, TODO, scope it
      return tpl.compiled.apply(this, arguments);
    }; })(tpl));
    //Template.registerHelper(name, tpl.helper);
    Template[name] = tpl.template;
  }

  // Debug brought you here?  Eval'd func actually run in tpl.template above.
  tpl.compiled = eval(data.compiled);
  //tpl.compiledFunc = eval('(function() { console.log(view); return ' + compiledText + '.apply(this,arguments); })');
  // TODO tpl.wrappedFunc = function(view) { return eval(compiledText) }

  tpl.dep.changed();

  if (templates.famousInit && !readies.get('famousInit'))
    readies.set('famousInit', true);
};

receiveHandlers.affectedTemplates = function(data) {
  for (var i=0; i < data.length; i++)
    if (templates[data[i]])
      templates[data[i]].dep.changed();
};

var lastCode = null;
receiveHandlers.javascript = function(data) {
  if (!readies.get('code'))
    readies.set('code', true);

  if (readies.get('famousInit')) {
    try {
      eval(data);
    } catch (error) {
      console.log(error);
    }
  } else {
    console.log('queu');
    lastCode = code;
  }
}


if (window.addEventListener)
  window.addEventListener('message', receiveMessage, false);
else if (window.attachEvent)
  window.attachEvent('onmessage', receiveMessage, false);
else
  alert('Not sure what browser you\'re using but we can\'t use it, sorry.');


Template.registerHelper('dstache', function() {
  return '{{';
});

// Global, used in lookups.  TODO, better way
view = { init: 1 };

/*
view = Blaze.View.prototype;
var origLookup = view.lookup;
view.lookup = function() {
  console.log(this, arguments);
  return origLookup.apply(this, arguments);
}
*/

Template.__FVL.helpers({
  result: function() {
    return (readies.get('famousInit') && readies.get('FVLbody') && readies.get('code'))
      ? Template.famousInit : null;
  }
});

FView.ready(function() {
  Blaze.render(Template.__FVL, document.body);
  readies.set('FVLbody', true);
});