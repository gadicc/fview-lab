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
  }
  return templates;
}

var isDevel = process.env.NODE_ENV === 'development';
var iframeSrc = isDevel
  ? 'http://localhost:6020'
  : 'https://fview-lab-sandbox.meteor.com';

Router.route('/embed/:_id', function() {
  var req = this.request;
  var res = this.response;

  var pad = Pads.findOne(this.params._id);
  var page = Pages.findOne({padId: this.params._id, pageNo: 1});

  var templates = compileTemplates('spacebars', page.templates.spacebars);

  var data = {
    pad: pad,
    page: page,
    padJSON: JSON.stringify(pad),
    pageJSON: JSON.stringify(page),
    templatesJSON: JSON.stringify(templates),
    javascript: JSON.stringify(page.code.javascript),
    iframeSrc: iframeSrc
  };

  res.end(SSR.render('embed', data));
}, { where: 'server' });
