var isDevel = Injected.obj('env').NODE_ENV === 'development';
var parentOrigin = isDevel
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
  if (event.origin !== parentOrigin || event.data.substr(0,10) !== 'fview-lab ') {
    // event.source == window.parent
    console.log('ignore', event);
    return;
  }

  var data = JSON.parse(event.data.substr(10));  // strip 'fview-lab '
  // console.log(data);
  if (typeof data === 'object' && data.type && receiveHandlers[data.type])
    receiveHandlers[data.type](data.data || data);
}

post = function(data) {
  window.parent.postMessage('fview-lab '+JSON.stringify(data), parentOrigin);
};

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

  if (!readies.get('FVLbody'))
    readies.set('FVLbody', true);

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

  /*
   * This was here to make sure Templates ran first, e.g. <template name="x">
   * before Template.x.something happened.  But this required a body to exist
   * for any code to be run, which maybe isn't what we wanted.  We'd like in
   * the future to cover a case where, Template.x.something breaks because
   * the template exists, but then that template is created.  XXX On change we
   * should try rerun everything if there were errors? XXX
   */
  //if (/* templates.__fvlBody && */ !readies.get('FVLbody'))
  //  readies.set('FVLbody', true);

  if (jsError)
    receiveHandlers.javascript(lastCode);
};

receiveHandlers.affectedTemplates = function(data) {
  for (var i=0; i < data.length; i++)
    if (templates[data[i]])
      templates[data[i]].dep.changed();
};

var lastCode = null, jsError = false;
receiveHandlers.javascript = function(code) {
  // in case we fail, we might try this again later
  lastCode = code;

  try {
    eval(code);
  } catch (error) {
    jsError = true;
    post({type:'setVar', name:'jsError', value:error.message});
    // console.log(error);
    return;
  }
  jsError = false;
  post({type:'setVar', name:'jsError', value:false});
};

receiveHandlers.clear = function() {
  readies.set('notFlushing', false);
  readies.set('FVLbody', false);
  // readies.set('code', false);
  for (var name in templates) {
    delete Template[name];
    delete templates[name];
  }
  styleEl.textContent = '';
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

receiveHandlers.css = function(data) {
  styleEl.textContent = data;
};

styleEl = null;
Meteor.startup(function() {
  styleEl = document.createElement('style');
  document.body.appendChild(styleEl);

  // We can do better!
  $(document).ready(function() {
    window.setTimeout(function() {
      post({ type: 'cheese' });
    }, 2000);
  });
});

Template.registerHelper('dstache', function() {
  return '{{';
});

// Global, used in lookups.  TODO, better way
view = null;

/*
 * Can't just post this, since it won't get run again and show itself fixed
 */
/*
var origBlazeViewAutoRun = Blaze.View.prototype.autorun;
Blaze.View.prototype.autorun = function() {
  try {
    origBlazeViewAutoRun.apply(this, arguments);
  } catch (err) {
    console.log(err);
  }
};
*/

var origDebug = Meteor._debug;
