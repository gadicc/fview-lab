FView.ready(function() {
  famous.polyfills;
  famous.core.famous;
});

var isDevel = Injected.obj('env').NODE_ENV === 'development';

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

  var data = JSON.parse(event.data.substr(11));
  console.log(data);
}

FView.ready(function() {
  FView.registerView('GridLayout', famous.views.GridLayout);
  FView.registerView('FlexibleLayout', famous.views.FlexibleLayout);
});

Template.registerHelper('dstache', function() {
  return '{{';
});

codeEditor = null, tplEditor = null;

templates = {};
var updateTemplates = function(event) {
  var value = tplEditor._editor.getValue();
  var errors = 0;

  var match, re = /<template name="(.*?)">([\s\S]*?)<\/template>/g;
  while ((match = re.exec(value)) !== null) {
    var name = match[1];
    var contents = match[2];
    try {
      var compiledText = SpacebarsCompiler.compile(contents);
    } catch (e) {
      errors++;
      break;
    }

    if (errors)
      return;

    if (!templates[name] || templates[name] !== compiledText) {
      templates[name] = compiledText;
      post({type:'template', name:name, compiled:compiledText});
    }
  }
};

codes = {};
var updateCode = function() {
  var content = codeEditor._editor.getValue();
  var parsed;

  try {
    parsed = esprima.parse(content);
  } catch (error) {
    return;
  }

  if (!parsed.body)
    return;

  // All we really want to know is which templates are potentially
  // affected by the code change, e.g. Template.x.helpers affects x.
  var affectedTemplates = [];
  _.each(parsed.body, function(item) {
    if (item.type === 'ExpressionStatement') {
      var checkit = null;

      if (item.expression.type === 'AssignmentExpression') {
        if (item.expression.left.object.object
            && item.expression.left.object.object.name === 'Template') {
          checkit = {
            tplName: item.expression.left.object.property.name,
            property: item.expression.left.property.name,
            serialized: JSON.stringify(item.expression.right)
          }
        }

      } else if (item.expression.type === 'CallExpression') {
        if (item.expression.callee.object.object
            && item.expression.callee.object.object.name === 'Template') {

          checkit = {
            tplName: item.expression.callee.object.property.name,
            method: item.expression.callee.property.name,
            serialized: JSON.stringify(item.expression.arguments)
          }            
        }
      } /* item.expression.type === 'CallExpression' */
    } /* item.type === 'ExpressionStatement' */

    if (checkit) {
      var code = codes[checkit.tplName];
      if (!code)
        code = codes[checkit.tplName] = {};

      if (!code.serialized || code.serialized !== checkit.serialized) {
        code.serialized = checkit.serialized;
        if (affectedTemplates.indexOf(checkit.tplName) === -1)
          affectedTemplates.push(checkit.tplName);
      }
    }

  }); /* _.each(parsed.body) */

  post({ type:'javascript', data:content });
  post({ type:'affectedTemplates', data:affectedTemplates });
};

Template.aces.rendered = function() {
  tplEditor = new ReactiveAce();
  tplEditor.attach(this.find('#tplEditor'));
  tplEditor.theme = "monokai";
  tplEditor.syntaxMode = "html";

  codeEditor = new ReactiveAce();
  codeEditor.attach(this.find('#codeEditor'));
  codeEditor.theme = "monokai";
  codeEditor.syntaxMode = 'javascript';
  codeEditor.parseEnabled = true

  tplEditor._editor.getSession().on('change', updateTemplates);
  codeEditor._editor.getSession().on('change', updateCode);
  updateTemplates();
  updateCode();

  window.e = codeEditor;
};

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

//Session.set('x', null);
Template.result.helpers({
  result: function() {
    return templateInit.get() ? Template.famousInit : null;
  }
});
