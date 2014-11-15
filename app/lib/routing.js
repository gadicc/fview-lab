Router.configure({
	layoutTemplate: 'layout'
});

/*
Router.route('/', {
	action: function() {
	}
});
*/

Router.route('/', {
  yieldRegions: {
    't1_guide': { to: 'guide' },
    'code': { to: 'code' },
    'result': { to: 'result' }
  }
});
