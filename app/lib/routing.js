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

// globals, since in editor.js we check to see if edit is really dirty
lastPage = {};
lastContent = {};

if (Meteor.isClient)
  if (!Session.getNR)
    Session.getNR = function(name) {
      return Tracker.nonreactive(function() { return Session.get(name); });
    }

PadController = RouteController.extend({
  layoutTemplate: 'padLayout',
  waitOn: function () {
    lastPage = {};
    lastContent = {};
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

    subs.subscribe('userById', pad.owners[0]);
    var author = Meteor.users.findOne(pad.owners[0]);
    var pageNo = parseInt(this.params.pageNo) || 1;

    var title = pad.title;
    if (pad.pages > 1)
      title += ' (' + pageNo + '/' + pad.pages + ')';

    Session.set('title', title)
    window.title = title + ' - fview-lab';

    Session.set('pageNo', pageNo);
    var page = Pages.findOne({ padId:pad._id, pageNo:pageNo });

    var shareit;
    if (page && author) {
      // code duped in models.js
      var match = page.guide && marked(page.guide).match(/<p>(.*)<\/p>/);
      var excerpt = page.guide && match ? match[1] :

        'FView Lab, Realtime Famo.us+Meteor Playground';
      shareit = {
        title: title + ' by ' + author.username,
        author: function() { return author; },
        url: this.url.replace(/\/[0-9]*$/, ''),
        excerpt: excerpt,
        thumbnail: function() { return page.webshot }
      };
    }

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

    var page = data.page, content;
    if (page) {
      if (page._id != lastPage._id) {
        post({ type:'clear' }); codes=[]; templates={};
      }

      content = Session.getNR('tplDirty') || prepareContent('tpl', page);
      if (content !== lastContent.tpl)
        updateEditor('tpl', lastContent.tpl = content);

      content = Session.getNR('codeDirty') || prepareContent('code', page);
      if (content !== lastContent.code)
        updateEditor('code', lastContent.code = content);

      content = Session.getNR('styleDirty') || page.style && page.style.css || "";
      if (content !== lastContent.style)
        updateEditor('style', lastContent.style = content);

      content = Session.getNR('guideDirty') || page.guide || "";
      if (content !== lastContent.guide)
        updateEditor('guide', lastContent.guide = content);

      lastPage = page;
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
  Router.route('/:username');
}
