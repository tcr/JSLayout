//----------------------------------------------------------------------
// Layout Styler
//----------------------------------------------------------------------

var LayoutStyler = Structure.extend({
	manager: null,
	constructor: function (manager) {
		this.manager = manager;
	}
	applyStyleBySelector: function (selector, style) {
		// orientation
		if ('orientation' in style && String(style.orientation).match(/^(vertical|horizontal)$/))
			this.document.querySelectorAll(selector).forEach(Utils.bind(function (element) {
				this.setOrientation(element, style.orientation);
			}, this));
		// layout property
//		if (LayoutManager.is(this.manager))
			for (var property in style)
				if (this.manager.getPropertyAxis(this.normalizeProperty(property)))
					forEach(Sizzle(selector, this.manager.document), Utils.bind(function (element) {
						this.manager.setFlexibleProperty(element, property, style[property]);
					}, this));
	},
	applyStyles: function (styles) {
		for (var selector in styles)
			this.applyStyleBySelector(selector, styles[selector]);
	}
});