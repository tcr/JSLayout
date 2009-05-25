//----------------------------------------------------------------------
// full-page layout manager
//----------------------------------------------------------------------

var FullLayoutManager = LayoutManager.extend({
	constructor: function (document, overflow) {
		// make document elements full-page
		var html = document.documentElement, body = document.getElementsByTagName('body')[0];
		CSSUtils.setStyles(html, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: overflow || 'hidden'});
		CSSUtils.setStyles(body, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: 'visible'});

		// construct manager
		LayoutManager.call(this, body);
	}
});

