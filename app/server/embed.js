var isDevel = process.env.NODE_ENV === 'development';
var iframeSrc = isDevel
  ? 'http://localhost:6020'
  : 'https://fview-lab-sandbox.meteor.com';

SSR.compileTemplate('embed', Assets.getText('embed.html'));

var compileTemplates = function(lang, value) {
  var templates={};
  if (lang == 'spacebars') {

    value = value.replace(/<body>([\s\S]*)<\/body>/,
      '<template name="__fvlBody">$1</template>');
    var match, re = /<template name="(.*?)">([\s\S]*?)<\/template>/g;
    while ((match = re.exec(value)) !== null) {
      var name = match[1];
      var contents = match[2];
      try {
        templates[name] = SpacebarsCompiler.compile(contents);
      } catch (err) {
        return false;
      }
    }

  } else if (lang == 'jade') {

    try {
      var results = jade.compile(value);
      results.templates.__fvlBody = results.body;
    } catch (err) {
      console.log(err);
      return false;
    }

    for (name in results.templates)
      templates[name] = SpacebarsCompiler.codeGen(results.templates[name]);

  }
  return templates;
};

var CoffeeScript = Meteor.npmRequire('coffee-script');

var routeAction = function() {
  var req = this.request;
  var res = this.response;

  var pad = Pads.findOne(this.params._id);
  var page = Pages.findOne({padId: this.params._id,
    pageNo: this.params.pageNo ? parseInt(this.params.pageNo) : 1});

  var templates;
  if (page.templates.spacebars)
    templates = compileTemplates('spacebars', page.templates.spacebars) || {
      '__fvlBody': SpacebarsCompiler.compile('Error in Spacebars template') };
  else if (page.templates.jade)
    templates = compileTemplates('jade', page.templates.jade) || {
      '__fvlBody': SpacebarsCompiler.compile('Error in Jade template') };
  else
    templates = {
      '__fvlBody': SpacebarsCompiler.compile('No template found') };

  var code;
  if (page.code.javascript)
    code = page.code.javascript;
  else if (page.code.coffee)
    code = CoffeeScript.compile(page.code.coffee);
  if (code)
    code = code.replace(/Template.body/g, 'Template.__fvlBody');

  var css = page.style && page.style.css;

  var data = {
    pad: pad,
    page: page,
    padJSON: JSON.stringify(pad),
    pageJSON: JSON.stringify(page),
    templatesJSON: JSON.stringify(templates),
    javascript: code ? JSON.stringify(code) : 'null',
    css: css ? JSON.stringify(css) : 'null',
    iframeSrc: iframeSrc
  };

  res.end(SSR.render('embed', data));
};

Router.route('/embed/:_id', routeAction, { where: 'server' });
Router.route('/embed/:_id/:pageNo', routeAction, { where: 'server' });
