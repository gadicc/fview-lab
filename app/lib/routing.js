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

Router.route('/', function() {
	Router.go('/pads/intro/1');
});

Router.route('/pads/:_id', function() {
	Router.go('pads', {_id: this.params._id, pageNo: ''});
});

Router.route('/pads/:_id/:pageNo', {
	name: 'pads',
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

		Session.set('isDirty', false);
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
			post({ type:'clear' }); codes={}; templates={};
			updateEditor('tpl', page.templates.spacebars);
			updateEditor('code', page.code.javascript);
		}
	},
  yieldRegions: {
    'guide': { to: 'guide' },
    'code': { to: 'code' },
    'result': { to: 'result' }
  }
});
