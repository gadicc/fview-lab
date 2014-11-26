subs = new SubsManager({
  cacheLimit: 10,
  expireIn: 30
});

if (Meteor.isClient)
  Router.plugin('dataNotFound', {notFoundTemplate: 'notFound'});

/*
 * Get the editor content for a page, using
 *   1) Current Session lang, if available
 *   2) Otherwise, autoconverted to current lang if possible
 *   3) Otherwise, switch Session lang to source lang
 */
var aceAliases = { spacebars: 'handlebars' };
var prepareContent = function(which, page) {
  var content = null;
  var sessName = which+'Lang';
  var pageKey = which === 'tpl' ? 'templates' : 'code';
  var currentLang = Session.get(sessName);
  var allLangs = Object.keys(page[pageKey]);

  if (allLangs.length && !(content = page[pageKey][currentLang])) {
    for (var i=0; i < allLangs.length; i++) {
      var lang = allLangs[i];
      if (lang === currentLang)
        continue;
      if (snippets.hasMapping(lang, currentLang)) {
        content = snippets.convert(page[pageKey][lang],
          lang, currentLang);
        break;
      }
    }
    if (!content && !userOwnsPad(Meteor.userId(), page.padId)) {
      Session.set(sessName, currentLang = allLangs[0]);
      content = page[pageKey][currentLang];
    }
  }

  var editor = window[which+'Editor'];
  if (editor)
    editor.syntaxMode = aceAliases[currentLang] || currentLang;

  return content;
}

PadController = RouteController.extend({
  layoutTemplate: 'padLayout',
  waitOn: function () {
    return [
      subs.subscribe('pad', this.params._id),
      subs.subscribe('page', this.params._id,
        this.params.pageNo ? parseInt(this.params.pageNo) : 1)
    ];
  },
  data: function() {
    var pad = Pads.findOne(this.params._id);
    if (!pad)
      return {};

    subs.subscribe('user', pad.owners[0]);
    var author = Meteor.users.findOne(pad.owners[0]);
    var pageNo = parseInt(this.params.pageNo) || 1;

    var title = pad.title;
    if (pad.pages > 1)
      title += ' (' + pageNo + '/' + pad.pages + ')';

    Session.set('title', title)
    window.title = title + ' - fview-lab';

    var guideContent = Tracker.nonreactive(function() { return Session.get('guideContent'); });
    if (!guideContent || Session.get('pageNo') !== pageNo) {
      Session.set('isDirty', false);
      Session.set('guideContent', null);
    }

    Session.set('pageNo', pageNo);
    var page = Pages.findOne({ padId:pad._id, pageNo:pageNo });

    var shareit;
    if (page && author)
      shareit = {
        title: title + ' @ fview-lab',
        author: function() { return author; },
        url: this.url.replace(/\/[0-9]*$/, ''),
        excerpt: page.guide ?
          marked(page.guide).match(/<p>(.*)<\/p>/)[1] :
          'FView Lab, Realtime Famo.us+Meteor Playground'
      };

    return {
      pad: pad,
      page: page,
      author: author,
      shareit: shareit
    }
  },
  onRun: function() {
    Meteor.call('routeView', this.url.replace(/https?:\/\/[^\/+]\//, ''));
    this.next();
  },
  onAfterAction: function() {
    var data = this.data();
    if (!data.pad)
      return;

    subs.subscribe('padStats', data.pad._id);

    var page = data.page;
    if (page) {
      post({ type:'clear' }); codes=[]; templates={};

      updateEditor('tpl', prepareContent('tpl', page));
      updateEditor('code', prepareContent('code', page));
      updateEditor('style', page.style && page.style.css);

      if (!Tracker.nonreactive(function() { return Session.get('guideContent'); }))
        updateEditor('guide', page.guide);
    }
  },
  yieldRegions: {
    'guide': { to: 'guide' },
    'code': { to: 'code' },
    'result': { to: 'result' }
  }
});

Router.route('/pads/:_id/:pageNo', {
  name: 'padPage',
  controller: 'PadController'
});

Router.route('/pads/:_id', {
  name: 'padHome',
  controller: 'PadController'
});

Router.route('/', function() {
  this.redirect('padHome', {_id: 'intro' });
});

if (Meteor.isServer) {
  SSR.compileTemplate('embed', Assets.getText('embed.html'));
}

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

Router.route('/embed/:_id', function() {
  var req = this.request;
  var res = this.response;

  var pad = Pads.findOne('intro');
  var page = Pages.findOne({padId: 'intro', pageNo: 1});

  var templates = compileTemplates('spacebars', page.templates.spacebars);

  var data = {
    pad: pad,
    page: page,
    padJSON: JSON.stringify(pad),
    pageJSON: JSON.stringify(page),
    templatesJSON: JSON.stringify(templates)
  };

  res.end(SSR.render('embed', data));
}, { where: 'server' });

if (Meteor.isServer) {
  Router.route('/:username');
}
