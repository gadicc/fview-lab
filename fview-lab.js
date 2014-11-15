if (Meteor.isClient) {
  codeEditor = null, tplEditor = null;
  templates = {};

  FView.ready(function() {
    FView.registerView('GridLayout', famous.views.GridLayout);
    FView.registerView('FlexibleLayout', famous.views.FlexibleLayout);
  });

  Template.registerHelper('dstache', function() {
    return '{{';
  });

  var templateInit = new ReactiveVar();

  var updateResult = _.debounce(function(event) {
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
        tpl.helper = new Template(name, (function(tpl) { return function() {
          tpl.dep.depend();
          return tpl.compiledFunc.apply(this, arguments);
        }; })(tpl));
        Template.registerHelper(name, tpl.helper);
      }
      if (!tpl.compiledText || tpl.compiledText !== compiledText) {
        tpl.compiledText = compiledText;
        tpl.compiledFunc = eval(compiledText);
        // console.log(tpl.name + ' changed');
        tpl.dep.changed();
      }
    }

    if (templates.famousInit && !templateInit.get())
      templateInit.set(true);

//    if (errors == 0)
//      Session.set('x', Date.now());
  }, 0);

  Template.aces.rendered = function() {
    tplEditor = new ReactiveAce();
    tplEditor.attach(this.find('#tplEditor'));
    tplEditor.theme = "monokai";
    tplEditor.syntaxMode = "html";

    codeEditor = new ReactiveAce();
    codeEditor.attach(this.find('#codeEditor'));
    codeEditor.theme = "monokai";
    codeEditor.syntaxMode = 'javascript';

    tplEditor._editor.getSession().on('change', updateResult);
    updateResult();
  };

  view = Blaze.View.prototype;

  //Session.set('x', null);
  Template.result.helpers({
    result: function() {
      return templateInit.get() ? templates.famousInit.helper : null;
    }
  });

  window.u = updateResult;
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
