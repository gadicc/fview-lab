var isDevel = Injected.obj('env').NODE_ENV === 'development';
var allowOrigin = isDevel
  ? 'http://localhost:6010'
  : 'https://fview-lab.meteor.com';

Template.body.helpers({
  reactiveBody: function() {
    // console.log('notFlushing', readies.get('notFlushing'));
    // console.log('FVLbody', readies.get('FVLbody'));
    return (readies.get('notFlushing') && readies.get('FVLbody'))
      ? Template.__fvlBody : null;
  }
});

Logger.setLevel('famous-views', 'trace');
/*
FView.ready(function() {
  Blaze.render(Template.__FVL, document.body);
});
*/

function receiveMessage(event) {
  if (event.origin !== allowOrigin || event.data.substr(0,10) !== 'fview-lab ') {
    // event.source == window.parent
    console.log('ignore', event);
    return;
  }

  var data = JSON.parse(event.data.substr(10));
  // console.log(data);
  if (typeof data === 'object' && data.type && receiveHandlers[data.type])
    receiveHandlers[data.type](data.data || data);
}

var readies = new ReactiveDict();
var receiveHandlers = {};

templates = {};
templatesQueue = [];
templatesAutorun = null;
receiveHandlers.template = function(data) {
  // New templates arriving before we finish flushing, queue them
  if (!readies.get('notFlushing')) {
    templatesQueue.push(data);
    if (!templatesAutorun) {
      templatesAutorun = Tracker.autorun(function() {
        if (readies.get('notFlushing')) {
          for (var i=0; i < templatesQueue.length; i++)
            receiveHandlers.template(templatesQueue[i]);
          templatesQueue = [];
          templatesAutorun.stop();
          templatesAutorun = false;
        }
      });
    }
    return;
  }

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

  if (templates.__fvlBody && !readies.get('FVLbody'))
    readies.set('FVLbody', true);
};

receiveHandlers.affectedTemplates = function(data) {
  for (var i=0; i < data.length; i++)
    if (templates[data[i]])
      templates[data[i]].dep.changed();
};

var lastCode = null;
receiveHandlers.javascript = function(data) {
  /*
  if (!readies.get('code'))
    readies.set('code', true);
  */

  if (readies.get('FVLbody')) {
    try {
      eval(data);
    } catch (error) {
      console.log(error);
    }
  } else {
    lastCode = data;
    var tracker = Tracker.autorun(function() {
      if (readies.get('FVLbody') && lastCode) {
        try {
          eval(lastCode);
        } catch (error) {
          console.log(error);
        }
        lastCode = null;
        tracker.stop();
      }
    });
  }
};

receiveHandlers.clear = function() {
  readies.set('notFlushing', false);
  readies.set('FVLbody', false);
  // readies.set('code', false);
  for (var name in templates) {
    delete Template[name];
    delete templates[name];
  }
  Tracker.afterFlush(function() {
    readies.set('notFlushing', true);
  });
};

if (window.addEventListener)
  window.addEventListener('message', receiveMessage, false);
else if (window.attachEvent)
  window.attachEvent('onmessage', receiveMessage, false);
else
  alert("Not sure what browser you're using but we can't use it, sorry.");


Template.registerHelper('dstache', function() {
  return '{{';
});

// Global, used in lookups.  TODO, better way
view = null;