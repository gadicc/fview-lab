var isDevel = Injected.obj('env').NODE_ENV === 'development';
var parentOrigin = isDevel
  ? 'http://localhost:6010'
  : 'https://fview-lab2.meteor.com';
var myOrigin = isDevel
  ? 'http://localhost:6020'
  : 'https://fview-lab-sandbox2.meteor.com';

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
          if (lastCode)
            receiveHandlers.javascript(lastCode);
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
      var view = this;
      if (!tpl.compiled)
        tpl.compiled = eval(tpl.source); // uses this scope, i.e. view above

      return tpl.compiled.apply(this, arguments);
    }; })(tpl));
    //Template.registerHelper(name, tpl.helper);
    Template[name] = tpl.template;
  }

  // Originally we eval'd the template here, but it got the wrong scope (i.e. view
  // identifier).  So now we do it at runtime, which makes more sense when
  // debugging too.
  tpl.source = data.compiled;
  if (tpl.compiled) delete tpl.compiled;

  tpl.dep.changed();

  /*
   * If we have an existing jsError, maybe it's because there were missing
   * template components.  Try rerun the code in case it works now.  But
   * not if we're in the middle of dequeueing.
   */
  if (jsError && templatesQueue.length === 0)
    receiveHandlers.javascript(lastCode);
};

receiveHandlers.affectedTemplates = function(data) {
  for (var i=0; i < data.length; i++)
    if (templates[data[i]])
      templates[data[i]].dep.changed();
};

receiveHandlers.resolvePossibleGlobals = function(data) {
  what = data.what.split('.');
  var base = window;
  for (var i=0; i < what.length-1; i++)
    base = base[what[i]];

  if (typeof base !== 'object') {
    post({type:'resolvePossibleGlobals', data: { id: data.id, results: [] }});
    return;
  }

  var keys = Object.keys(base);
  what = what[what.length-1];
  if (what !== '')
    keys = _.filter(keys, function(key) {
      return key.substr(0, what.length) === what;
    });
  post({type:'resolvePossibleGlobals', data: { id: data.id, results: keys }});
};

var myOriginRE = new RegExp(myOrigin);
window.onerror = function(message, url, line, col, error) {
  jsError = true;
  // console.log('onerror', arguments);

  var match, stack = printStackTrace({e: error});

  if (stack && stack.length) {
    for (var i=0; i < stack.length; i++)
      stack[i] = stack[i]
        .replace(myOriginRE, '')
        .replace(/\.js\?[0-9a-f]+:/, '.js:');
  }

  // get line&col from stack trace if not provided by browser
  if (!line && stack && stack.length
      && (match = stack[0].match(/:([0-9]+):([0-9]+)$/))) {
    line = match[1];
    col = match[2];
  }

  post({type:'setVar', name:'jsError', value: {
    message: message,
    url: url,
    line: line,
    col: col,
    stack: stack
  }});

  return false;
};

Blaze._wrapCatchingExceptions = function (f, where) {
  if (typeof f !== 'function')
    return f;

  return function () {
    try {
      return f.apply(this, arguments);
    } catch (e) {
      window.onerror(e.message, undefined, undefined, undefined, e);
      Blaze._reportException(e, 'Exception in ' + where + ':');
    }
  };
};

var lastCode = null, jsError = false;
receiveHandlers.javascript = function(code) {
  // in case we fail, we might try this again later
  lastCode = code;

  // don't run code before templates are ready (e.g. sent during flush)
  if (!readies.get('FVLbody')) {
    jsError = true;
    return;
  }

  jsError = false;
  var script = document.createElement('script');
  script.appendChild(document.createTextNode(code));
  document.body.appendChild(script);
  document.body.removeChild(script);

  // could be set in window.onerror
  if (jsError == false)
    post({type:'setVar', name:'jsError', value:false});
};

globalKeys = [];
Meteor.startup(function() {
  globalKeys = Object.keys(window);
});

receiveHandlers.clear = function() {
  // Once we set FLVbody to false, Blaze will cleanup
  // It's important that we don't start a new render before
  // this completes, hence the notFlushing var.
  readies.set('FVLbody', false);
  readies.set('notFlushing', false);

  // Cleanup globals
  var currentGlobals = Object.keys(window);
  for (var i=0; i < currentGlobals.length; i++)
    if (globalKeys.indexOf(currentGlobals[i]) === -1)
      delete window[currentGlobals[i]];

  // Cleanup Templates
  for (var name in templates) {
    delete Template[name];
    delete templates[name];
  }

  // Cleanup CSS
  styleEl.textContent = '';

  // Cleanup queued code
  /*
  jsError = false;
  lastCode = null;
  */

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
