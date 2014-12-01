subs = new SubsManager({
  cacheLimit: 10,
  expireIn: 30
});

if (Meteor.isClient)
  Router.plugin('dataNotFound', {notFoundTemplate: 'notFound'});

/*
 * Get the editor content for a page, using
 *   1) The current session lang, if it exists
 *   2) Otherwise, autoconverted to current lang if possible
 *   3) Otherwise, switch Session lang to source lang
 *      except if forceLang set, then use boilerplate
 */
var aceAliases = { spacebars: 'handlebars' };
forceLang = { tpl: false, code: false };
var prepareContent = function(which, page) {
  var content;
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
    if (forceLang[which])
      forceLang[which] = false;
    else if (!content) {
      Session.set(sessName, currentLang = allLangs[0]);
      content = page[pageKey][currentLang];
    }
  }

  var editor = window[which+'Editor'];
  if (editor)
    editor.syntaxMode = aceAliases[currentLang] || currentLang;

  // boiler plate code (if content === undefined; "" is intentionally blank)
  if (which === 'tpl' && content === undefined) {
    page.lastPos = { templates: {} };
    page.lastEditor = 'tpl';
    if (currentLang === 'jade') {
      content = 'body\n' +
        '  +famousContext id="mainCtx"\n' +
        '    +Surface\n' +
        '      | ';
      page.lastPos.templates.jade = [4,9];
    } else {
      content = '<body>\n' +
        '  {{#famousContext id="mainCtx"}}\n' +
        '    {{#Surface}}\n' +
        '      \n' +
        '    {{/Surface}}\n' +
        '  {{/famousContext}}\n</body>';
      page.lastPos.templates.spacebars = [4,7];
    }
  }

  return content || "";
}

// globals, since in editor.js we check to see if edit is really dirty
lastPage = {};
lastContent = {};

if (Meteor.isClient)
  if (!Session.getNR)
    Session.getNR = function(name) {
      return Tracker.nonreactive(function() { return Session.get(name); });
    }

Router.configure({
  trackPageView: true
});

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

    subs.subscribe('userById', pad.owner);
    var author = Meteor.users.findOne(pad.owner);
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

    // now that everything else is ready, load adjacent pages in background
    // it's ok if it's a resubscribe from previous route.
    if (data.page) {
      if (data.page.pageNo > 1)
        subs.subscribe('page', data.pad._id, data.page.pageNo-1);
      if (data.page.pageNo < data.pad.pages)
        subs.subscribe('page', data.pad._id, data.page.pageNo+1);
    }
      
    subs.subscribe('padStats', data.pad._id);

    var page = data.page, content;
    if (page) {
      if (page._id != lastPage._id) {
        post({ type:'clear' }); codes=[]; templates={};
      }

      content = Session.getNR('tplDirty') || prepareContent('tpl', page);
      if (content !== lastContent.tpl)
        updateEditor('tpl', lastContent.tpl = content, page);

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

/* other routes */

if (Meteor.isServer) {
  // in user.js
  Router.route('/:username');
}
