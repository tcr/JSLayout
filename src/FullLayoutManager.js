//----------------------------------------------------------------------
// full-page layout manager
//----------------------------------------------------------------------

var FullLayoutManager = LayoutManager.extend({
	constructor: function (document, overflow) {
		//[FIX] older browsers need overflow on body, not document element
		var onBody = Utils.isUserAgent(/MSIE 6\./);
		
		// make document elements full-page
		var html = document.documentElement, body = document.getElementsByTagName('body')[0];
		CSSUtils.setStyles(html, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: onBody ? 'visible' : overflow || 'hidden'});
		CSSUtils.setStyles(body, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: onBody ? overflow || 'hidden' : 'visible'});

		// construct manager
		LayoutManager.call(this, body);
	}
});

