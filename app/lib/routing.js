subs = new SubsManager({
	cacheLimit: 10,
	expireIn: 30
});

Router.configure({
	layoutTemplate: 'layout'
});

/*
Router.route('/', {
	action: function() {
	}
});
*/

PadController = RouteController.extend({
  layoutTemplate: 'layout',
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

		return {
			pad: pad,
			page: Pages.findOne({ padId:pad._id, pageNo:pageNo })
		}
	},
	onAfterAction: function() {
		var data = this.data();
		if (!data.pad)
			return;

		var page = data.page;
		if (page) {
			post({ type:'clear' }); codes=[]; templates={};

			var content, allLangs, currentLang;

			currentLang = Session.get('tplLang');
			allLangs = Object.keys(page.templates);
			content = null;
			if (allLangs.length && !(content = page.templates[currentLang])) {
				for (var i=0; i < allLangs.length; i++) {
					var lang = allLangs[i];
					if (lang === currentLang)
						continue;
					if (snippets.hasMapping(lang, currentLang)) {
						content = snippets.convert(page.templates[lang],
							lang, currentLang);
						break;
					}
				}
				if (!content && !userOwnsPad(Meteor.userId(), page.padId)) {
					Session.set('tplLang', currentLang = allLangs[0]);
					content = page.templates[currentLang];
				}
			}
			updateEditor('tpl', content);
		  tplEditor.syntaxMode = currentLang === 'spacebars'
		  	? 'handlebars' : 'jade';

			updateEditor('code', page.code[Session.get('codeLang')]);

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
	Router.go('padHome', {_id: 'intro' });
});