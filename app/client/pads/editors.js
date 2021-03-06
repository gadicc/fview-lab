// our new place for exports, use instead of globals
Editors = {};

Session.setDefault('codeLang', 'javascript');
Session.setDefault('tplLang', 'spacebars');

// var isOwnerOrTranslationExistsOrIsTranslateable() :)

Template.editors.events({
  'click a': function(event, tpl) {
    event.preventDefault();
    var type = event.target.getAttribute('data-type');
    if (Session.get(type+'Dirty') && !navigateWithUnsavedWork())
      return;

    var newLang = event.target.getAttribute('data-value');
    forceLang[type] = true;
    Session.set(type+'Lang', newLang);
    Session.set(type+'Dirty', false);
  }
});

Session.set('tplError', false);
Template.editors.helpers({
  editGuide: function() { return Session.get('editGuide'); },
  isLangCSS: function(type, lang) {
    return Session.equals(type+'Lang', lang) ? 'selected' : '';
  },
  tplError: function() { return Session.get('tplError'); },
  jsError: function() {
    var e;
    return Session.get('jsError') || (
      (e = sandbox.get('jsError')) ? e.message+'\n'+e.stack.join('\n') : null
    );
  },
  isDirty: function(what) { return Session.get(what+'Dirty'); }
});
Template.editGuideTpl.helpers({
  isDirty: function() { return Session.get('guideDirty'); }
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

  if (editorQueue.guide)
    updateEditor('guide', editorQueue.guide);
};
Template.editGuideTpl.destroyed = function() {
  // Destroy reference so updateEditor will correctly queue content
  // if the editor is "hidden" by the user (i.e. destroyed)
  guideEditor = null;
};

completeCBs = {};
completeCBcount = 0;
var codeCompleter = {
  getCompletions: function(editor, session, pos, prefix, callback) {
    var lineUntilCursor = session.getLine(pos.row).substr(0, pos.column);
    var what = lineUntilCursor.match(/[^A-Za-z_\-\.]+(.*?)$/);
    what = what ? what[1] : lineUntilCursor;
    
    var id = completeCBcount++;
    completeCBs[id] = callback;
    post({ type : 'resolvePossibleGlobals', data: { id:id,what:what } });
  }
};
if (typeof receiveHandlers === 'undefined')
  receiveHandlers = {};
receiveHandlers.resolvePossibleGlobals = function(data) {
  if (!completeCBs[data.id])
    return;
  completeCBs[data.id](null, data.results.sort().map(function(word, index) {
    return {
      caption: word,
      value: word,
      score: 1 - (index/100),
      meta: "globals"
    };
  }));
  delete completeCBs[data.id];
};

var acePath = '/packages/dcsan_reactive-ace/vendor/ace/src/';
var aceLangtoolsLoaded = null;
$.getScript(acePath + 'ext-language_tools.js', function() {
  ace.require("ace/ext/language_tools");
  aceLangtoolsLoaded = true;
  // editor loaded before lang tools script
  if (codeEditor)
    langToolsAndEditorLoaded(codeEditor._editor);
});

function langToolsAndEditorLoaded(editor) {
  if (aceLangtoolsLoaded) {
    editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: false
    });
    editor.completers.push(codeCompleter);
    editor.commands.on("afterExec", function(e){ 
      if (e.command.name == "insertstring"&&/^[\w.]$/.test(e.args)) { 
        codeComplete(); 
      } 
    });
  }
}

codeEditor = null, tplEditor = null, styleEditor = null;
var codeComplete = _.debounce(function() {
  codeEditor._editor.execCommand("startAutocomplete")
}, 750);
Template.editors.rendered = function() {
  tplEditor = new ReactiveAce();
  tplEditor.attach(this.find('#tplEditor'));
  tplEditor.theme = "monokai";

  codeEditor = new ReactiveAce();
  codeEditor.attach(this.find('#codeEditor'));
  codeEditor.theme = "monokai";
  codeEditor.syntaxMode = Session.get('codeLang');
  codeEditor.parseEnabled = true;

  langToolsAndEditorLoaded(codeEditor._editor);

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
updateEditor = function(which, content, page) {
  if (!content) content = '';
  var editor = window[which + 'Editor'];
  if (editor) {
    useThisValue = content;
    editor._editor.setValue(content, -1);
    useThisValue = false;

    if (page) {
      var which2 = which === 'tpl' ? 'templates' : which;
      var pos = page.lastPos && page.lastPos[which2] &&
        page.lastPos[which2][Session.getNR(which+'Lang')];
      if (pos)
        editor._editor.gotoLine.apply(editor._editor, pos);
      if (page.lastEditor === which)
        editor._editor.focus();
    }
  } else
    editorQueue[which] = content;
};

// TODO move to view
Session.setDefault('tplDirty', false);
Session.setDefault('codeDirty', false);
Session.setDefault('styleDirty', false);
Session.setDefault('guideDirty', false);
Tracker.autorun(function() {
  // We use Session.equals to trigger reactive change only on false/non-false,
  // since we store the entire dirty contents in the Session var
  Session.set('isDirty', !(
    Session.equals('tplDirty', false) && Session.equals('codeDirty', false) &&
    Session.equals('styleDirty', false) && Session.equals('guideDirty', false)
  ));
});

/*
 * Called on every template editor update.
 * Go through each template and see what's changed, post to sandbox
 */
templates = {}; includingTemplates = {};
var updateTemplates = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var value = useThisValue === false ? tplEditor._editor.getValue() : useThisValue;

  if (useThisValue === false)
    Session.set('tplDirty', value === lastContent.tpl ? false : value);

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

  // TODO, clean up removed templates.

  //var re = /Spacebars.include\(view.lookupTemplate\("(.*?)"\)/g;
  var re = /template: Spacebars.call\("(.*?)"\)/g;
  for (var name in templates) {
    var match, tpl = templates[name];
    while(match = re.exec(tpl)) {
      var include = match[1];
      if (templates[include]) {
        if (!includingTemplates[include])
          includingTemplates[include] = [];
        insertNoDupes(includingTemplates[include], name);
      }
    }
  }
};

/*
 * Called on every code editor update
 * Post code to sandbox
 * Go through code and see if any Template.x stuff has been done,
 * and post affectedTemplates to sandbox
 */
//codes = {};
codes = [];
lastCodeContent = null;
var updateCode = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? codeEditor._editor.getValue() : useThisValue;
  var parsed;

  if (useThisValue === false)
    Session.set('codeDirty', content === lastContent.code ? false : content);

  content = content.replace(/Template.body/g, 'Template.__fvlBody');

  // Avoid superfluous updates on same code as last time
  if (lastCodeContent === content)
    return;

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
      // unwrap compiled coffee
      content = content.replace(/^\(function\(\) \{([\s\S]*)\}\).call\(this\);\n/, '$1');
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

            // mark for rerender, either the mentioned template, or it's
            // parent if using rendered() since we want it to redraw on edit
            var prop = item.expression.left.property.name;
            var tplName = item.expression.left.object.property.name;
            if (prop === 'rendered' && includingTemplates[tplName])
              insertNoDupes(affectedTemplates, includingTemplates[tplName]);
            else
              insertNoDupes(affectedTemplates, tplName);
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

  // i.e. don't send the fist time, only after a code change
  if (lastCodeContent)
    post({ type: 'affectedTemplates', data: affectedTemplates });

  lastCodeContent = content;
};

var updateStyle = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? styleEditor._editor.getValue() : useThisValue;

  if (useThisValue === false)
    Session.set('styleDirty', content === lastContent.style ? false : content);

  post({ type: 'css', data: content });
};

var updateGuide = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? guideEditor._editor.getValue() : useThisValue;

  if (useThisValue === false)
    Session.set('guideDirty', content === lastContent.guide ? false : content);
};

// should be used on any event that will navigate away and destroy template
navigateWithUnsavedWork = function() {
  if (Session.get('isDirty')) {
    var a = confirm('Unsaved work will be lost.  Are you sure?');
    if (a) {
      Session.set('isDirty', false);
      Session.set('tplDirty', false);
      Session.set('codeDirty', false);
      Session.set('styleDirty', false);
      Session.set('guideDirty', false);
    }
    return a;
  } else
    return true;
};

Editors.refresh = function() {
  // force a "hard" refresh
  iframe.loaded = false; iframe.src += '';

  // if above line is commented out, this will still do a "soft" refresh
  post({ type:'clear' }); codes=[]; templates={};
  updateTemplates(); lastCodeContent=null; updateCode(); updateStyle();
};
