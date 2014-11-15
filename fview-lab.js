if (Meteor.isClient) {
  codeEditor = null, tplEditor = null;

  FView.ready(function() {
    FView.registerView('GridLayout', famous.views.GridLayout);
    FView.registerView('FlexibleLayout', famous.views.FlexibleLayout);
  });

  Template.registerHelper('dstache', function() {
    return '{{';
  });

  templates = {};
  var templateInit = new ReactiveVar();
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

      // setup new reactive dep for each template helper, hahaha cooo!
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
          return tpl.compiledFunc.apply(this, arguments);
        }; })(tpl));
        //Template.registerHelper(name, tpl.helper);
        Template[name] = tpl.template;
      }
      if (!tpl.compiledText || tpl.compiledText !== compiledText) {
        tpl.compiledText = compiledText;
        // Debug brought you here?  Eval'd func actually run in tpl.template above.
        tpl.compiledFunc = eval(compiledText);
        //tpl.compiledFunc = eval('(function() { console.log(view); return ' + compiledText + '.apply(this,arguments); })');
        // TODO tpl.wrappedFunc = function(view) { return eval(compiledText) }
        tpl.dep.changed();
      }
    }

    if (templates.famousInit && !templateInit.get())
      templateInit.set(true);

//    if (errors == 0)
//      Session.set('x', Date.now());
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

    try {
      eval(content);
    } catch (error) {

    }

    for (var i=0; i < affectedTemplates.length; i++)
      if (templates[affectedTemplates[i]])
        templates[affectedTemplates[i]].dep.changed();
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
}

/* both */

Router.configure({
  layoutTemplate: 'layout'
});

Router.route('/', {
  yieldRegions: {
    't1_guide': { to: 'guide' },
    'code': { to: 'code' },
    'result': { to: 'result' }
  }
});
