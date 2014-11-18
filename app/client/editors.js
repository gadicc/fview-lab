Template.editors.events({
  'click a': function(event, tpl) {
    var type = event.target.getAttribute('data-type');
    var value = event.target.getAttribute('data-value');
    console.log(type, value);
  }
});

Template.editors.helpers({
  'editGuide': function() { return Session.get('editGuide'); }
});

guideEditor = null;
Template.editGuideTpl.rendered = function() {
  guideEditor = new ReactiveAce();
  guideEditor.attach(this.find('#guideEditor'));
  guideEditor.theme = "monokai";
  guideEditor.syntaxMode = "markdown";

  guideEditor._editor.setOptions({
    maxLines: Infinity
  });

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
  tplEditor.syntaxMode = "handlebars";

  codeEditor = new ReactiveAce();
  codeEditor.attach(this.find('#codeEditor'));
  codeEditor.theme = "monokai";
  codeEditor.syntaxMode = 'javascript';
  codeEditor.parseEnabled = true

  styleEditor = new ReactiveAce();
  styleEditor.attach(this.find('#styleEditor'));
  styleEditor.theme = "monokai";
  styleEditor.syntaxMode = 'css';

  tplEditor._editor.getSession().on('change', updateTemplates);
  codeEditor._editor.getSession().on('change', updateCode);

  _.each([codeEditor._editor, tplEditor._editor, styleEditor._editor],
    function(editor) {
      editor.setOptions({
        maxLines: Infinity,
      });
      var session = editor.getSession();
      session.setUseWrapMode(true);
    });

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
  var errors = 0;

  if (!useThisValue && !Session.get('isDirty'))
    Session.set('isDirty', true);

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

/*
 * Called on every code editor update
 * Post code to sandbox
 * Go through code and see if any Template.x stuff has been done,
 * and post affectedTemplates to sandbox
 */
codes = {};
var updateCode = function(event) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? codeEditor._editor.getValue() : useThisValue;
  var parsed;

  if (!useThisValue && !Session.get('isDirty'))
    Session.set('isDirty', true);

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
      var what = checkit.method || checkit.property;
      if (!code)
        code = codes[checkit.tplName] = {};

      if (!code[what] || code[what] !== checkit.serialized) {
        code[what] = checkit.serialized;
        if (affectedTemplates.indexOf(checkit.tplName) === -1)
          affectedTemplates.push(checkit.tplName);
      }
    }

  }); /* _.each(parsed.body) */

  post({ type: 'javascript', data: content });
  post({ type: 'affectedTemplates', data: affectedTemplates });
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
