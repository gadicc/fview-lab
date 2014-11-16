codeEditor = null, tplEditor = null;
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

  if (editorQueue.tpl)
    tplEditor._editor.setValue(editorQueue.tpl);
  if (editorQueue.code)
    codeEditor._editor.setValue(editorQueue.code);
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
    editor._editor.setValue(content);
    ignoreUpdate = false;
  }
  else
    editorQueue[which] = content;
}

/*
 * Called on every template editor update.
 * Go through each template and see what's changed, post to sandbox
 */
templates = {};
var updateTemplates = function(event, force) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var value = useThisValue === false ? tplEditor._editor.getValue() : useThisValue;
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

/*
 * Called on every code editor update
 * Post code to sandbox
 * Go through code and see if any Template.x stuff has been done,
 * and post affectedTemplates to sandbox
 */
codes = {};
var updateCode = function(event, force) {
  // Weird ace bug?  getValue() returns old value, let's only use for user update
  var content = useThisValue === false ? codeEditor._editor.getValue() : useThisValue;
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
