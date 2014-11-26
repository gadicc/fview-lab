Session.setDefault('codeLang', 'javascript');
Session.setDefault('tplLang', 'spacebars');

// var isOwnerOrTranslationExistsOrIsTranslateable() :)

Template.editors.events({
  'click a': function(event, tpl) {
    var type = event.target.getAttribute('data-type');
    var newLang = event.target.getAttribute('data-value');
    Session.set(type+'Lang', newLang);
  }
});

Session.set('tplError', false);
Template.editors.helpers({
  editGuide: function() { return Session.get('editGuide'); },
  isLangCSS: function(type, lang) {
    return Session.equals(type+'Lang', lang) ? 'selected' : '';
  },
  tplError: function() { return Session.get('tplError'); },
  jsError: function() { return Session.get('jsError'); }
});

guideEditor = null;
Template.editGuideTpl.rendered = function() {
  guideEditor = new ReactiveAce();
  guideEditor.attach(this.find('#guideEditor'));
  guideEditor.theme = "monokai";
  guideEditor.syntaxMode = "markdown";

  var editor = guideEditor._editor;
  editor.setOptions({
    maxLines: Infinity
  });
  var session = editor.getSession();
  session.setUseWrapMode(true);
  session.setTabSize(2);
  session.setUseSoftTabs(true);

  guideEditor._editor.getSession().on('change', updateGuide);

  var content;
  if (content = Session.get('guideContent'))
    updateEditor('guide', content);
  else if (editorQueue.guide)
    updateEditor('guide', editorQueue.guide);
  else if (this.page)
    updateEditor('guide', this.page.guide);
}

codeEditor = null, tplEditor = null, styleEditor = null;
Template.editors.rendered = function() {
  tplEditor = new ReactiveAce();
  tplEditor.attach(this.find('#tplEditor'));
  tplEditor.theme = "monokai";

  codeEditor = new ReactiveAce();
  codeEditor.attach(this.find('#codeEditor'));
  codeEditor.theme = "monokai";
  codeEditor.syntaxMode = Session.get('codeLang');
  codeEditor.parseEnabled = true;

  styleEditor = new ReactiveAce();
  styleEditor.attach(this.find('#styleEditor'));
  styleEditor.theme = "monokai";
  styleEditor.syntaxMode = 'css';

  tplEditor._editor.getSession().on('change', updateTemplates);
  codeEditor._editor.getSession().on('change', updateCode);
  styleEditor._editor.getSession().on('change', updateStyle);

  _.each([codeEditor._editor, tplEditor._editor, styleEditor._editor],
    function(editor) {
      editor.setOptions({
        maxLines: Infinity,
      });
      var session = editor.getSession();
      session.setUseWrapMode(true);
      session.setTabSize(2);
      session.setUseSoftTabs(true);
    });

  // Set in routing.js
  if (editorQueue.tpl)
    updateEditor('tpl', editorQueue.tpl)
  if (editorQueue.code)
    updateEditor('code', editorQueue.code)
  if (editorQueue.style)
    updateEditor('style', editorQueue.style)
};

/*
 * Update contents of an editor.  If the editor isn't rendered yet,
 * queue the content.
 */
var editorQueue = {}; var useThisValue = false;
updateEditor = function(which, content) {
  if (!content) content = '';
  var editor = window[which + 'Editor'];
  if (editor) {
    useThisValue = content;
    editor._editor.setValue(content, -1);
    useThisValue = false;
  }
  else
    editorQueue[which] = content;
};

/*
 * Called on every template editor update.
 * Go through each template and see what's changed, post to sandbox
 */
templates = {};
var updateTemplates = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var value = useThisValue === false ? tplEditor._editor.getValue() : useThisValue;

  if (!useThisValue && !Session.get('isDirty'))
    Session.set('isDirty', true);

  switch(Session.get('tplLang')) {

    case 'spacebars':
      value = value.replace(/<body>([\s\S]*)<\/body>/,
        '<template name="__fvlBody">$1</template>');
      var match, re = /<template name="(.*?)">([\s\S]*?)<\/template>/g;
      while ((match = re.exec(value)) !== null) {
        var name = match[1];
        var contents = match[2];
        try {
          var compiledText = SpacebarsCompiler.compile(contents);
        } catch (err) {
          Session.set('tplError', err.message);
          return;
        }

        if (!templates[name] || templates[name] !== compiledText) {
          templates[name] = compiledText;
          post({type:'template', name:name, compiled:compiledText});
        }
      }
      Session.set('tplError', false);
      break;

    case 'jade':
      try {
        var results = jadeClient.compile(value);
        results.templates.__fvlBody = results.body;
      } catch (err) {
        Session.set('tplError', err.message);
        return;
      }
      Session.set('tplError', false);

      for (name in results.templates) {
        var compiledText = SpacebarsCompiler.codeGen(results.templates[name]);
        if (!templates[name] || templates[name] !== compiledText) {
          templates[name] = compiledText;
          post({type:'template', name:name, compiled:compiledText});
        }
      }
      break;

    default:
      throw new Error("Don't know how to handle " + Session.get('tplLang'));
  }; /* switch(lang) */
};

/*
 * Called on every code editor update
 * Post code to sandbox
 * Go through code and see if any Template.x stuff has been done,
 * and post affectedTemplates to sandbox
 */
//codes = {};
codes = [];
var updateCode = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? codeEditor._editor.getValue() : useThisValue;
  var parsed;

  if (!useThisValue && !Session.get('isDirty'))
    Session.set('isDirty', true);

  content = content.replace(/Template.body/g, 'Template.__fvlBody');

  switch(Session.get('codeLang')) {

    case 'javascript':
      break;

    case 'coffee':
      try {
        content = CoffeeScript.compile(content);
      } catch (error) {
        Session.set('jsError', error.message);
        return;
      }
      break;

    default:
      throw new Error("Don't know hot o ahndle " + Session.get('codeLang'));

  }

  try {
    parsed = esprima.parse(content);
  } catch (error) {
    Session.set('jsError', error.message);
    return;
  }
  Session.set('jsError', false);

  if (!parsed.body)
    return;

  /*
   * We actually pass all the JavaScript to be eval'd in the sandbox.
   * But what's important is what is new or changed, and which templates
   * that effects.  If only a `Template.myTpl.something =` or
   * `Template.myTpl.something()` was new or changed, we only need
   * myTpl to be rerendered.  If anything else was changed, to be safe,
   * we have to rerendered the entire body and don't care anymore, ie.
   * `affectedTemplates = ['__fvlBody']; break;`
   *
   * To super optimize, we could see which globals are being used by
   * which template callbacks... but, no need for that as this point.
   */
  var newCodes = [], affectedTemplates = [], changed = false;
  for (var i=0; i < parsed.body.length; i++) {
    newCodes.push(hash(JSON.stringify(parsed.body[i])));
    if (codes.indexOf(newCodes[i]) === -1) {
      var item = parsed.body[i];
      if (!changed) changed = true;

      if (item.type === 'ExpressionStatement') {
        if (item.expression.type === 'AssignmentExpression') {
          // Template.name.something =
          if (item.expression.left
              && item.expression.left.object
              && item.expression.left.object.object
              && item.expression.left.object.object.name === 'Template') {
            insertNoDupes(affectedTemplates,
              item.expression.left.object.property.name);
          } else {
            affectedTemplates = ['__fvlBody']; break;
          }
        } else if (item.expression.type === 'CallExpression') {
          // Template.name.something()
          if (item.expression.callee
              && item.expression.callee.object
              && item.expression.callee.object.object
              && item.expression.callee.object.object.name === 'Template') {
            insertNoDupes(affectedTemplates,
              item.expression.callee.object.property.name);
          } else {
            affectedTemplates = ['__fvlBody']; break;
          }
        } /* item.expression.type === 'CallExpression' */
      } /* item.type === 'ExpressionStatement' */ else {
        affectedTemplates = ['__fvlBody']; break;
      }
    }
  }

  if (!changed && codes.length === newCodes.length)
    return;

  codes = newCodes; // all currently existing

  post({ type: 'javascript', data: content });
  post({ type: 'affectedTemplates', data: affectedTemplates });
};

var updateStyle = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? styleEditor._editor.getValue() : useThisValue;

  if (!useThisValue && !Session.get('isDirty'))
    Session.set('isDirty', true);

  post({ type: 'css', data: content });
};

var updateGuide = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? guideEditor._editor.getValue() : useThisValue;
  if (!useThisValue) {
    if (!Session.get('isDirty'))
      Session.set('isDirty', true);
    Session.set('guideContent', content);
  }
};
