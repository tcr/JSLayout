//----------------------------------------------------------------------
// CSS Box
//----------------------------------------------------------------------

var CSSBox = Base.extend({
	constructor: function (element) {
		if (!element || element.nodeType !== 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.view = DOMUtils.getOwnerDocument(element).defaultView || window;
	},
	_getRoughOffset: function () {
		if (this.element.getBoundingClientRect) {
			var rect = this.element.getBoundingClientRect();
			return {x: rect.left, y: rect.top};
		}
		// offsetTop, left
		return {x: this.element.offsetLeft, y: this.element.offsetTop};
	},
	_shiftDimension: function (dimension, axis, prop, expand) {
		return dimension + (this.getCSSLength(prop + '-' + CSSBox.AXIS_TL[axis]) + this.getCSSLength(prop + '-' + CSSBox.AXIS_BR[axis]))*(expand?1:-1)
	},
	getBoxDimension: function (type, axis) {
		if (type == 'content')
			return this.getCSSLength(CSSBox.AXIS_DIMENSION[axis]);
		if (this.element.getBoundingClientRect) {
			var rect = this.element.getBoundingClientRect();
			var dimension = rect[CSSBox.AXIS_BR[axis]] - rect[CSSBox.AXIS_TL[axis]];
		} else
			var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		switch (type) {
			case 'margin': return this._shiftDimension(dimension, axis, 'margin', true);
			case 'border': return dimension;
			case 'padding': return this._shiftDimension(dimension, axis, 'border', false);
		}
	},
	getCSSLength: function (property) {
		property = this._normalizeProperty(property);
		if (this.view.getComputedStyle) {
			var computedStyle = this.view.getComputedStyle(this.element, null);
			//[FIX] safari interprets computed margins weirdly (see Webkit bugs #19828, #13343)
			if (DOMUtils.isUserAgent(/KTML|Webkit/i) && property == 'margin-right' &&
			    computedStyle.getPropertyValue('float') == 'none')
//[TODO] is there a quicker way than float: left?
				return parseFloat(DOMUtils.swapStyles(this.element, {'float': 'left'}, bind(function () {
					return this.view.getComputedStyle(this.element, null).getPropertyValue(property);
				}, this)));
			// return computed style value
			return parseFloat(computedStyle.getPropertyValue(property));
		}
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
			var currentVal = DOMUtils.getStyleProperty(this.element.currentStyle, property);
			if (property.match(/^(width|height)$/))
				return this._shiftDimension(this.getBoxDimension('padding', {width: 'horizontal', height: 'vertical'}[property]), 'padding', false);
			if (/^\-?\d+(px)?$/i.test(currentVal) || currentVal == 'none')
				return parseFloat(currentVal) || 0;
			if (property.match(/^border/) && !(/^\-\d+/.test(currentVal))) { // border word-values
				var runtimeStyleVal = this.element.runtimeStyle.borderTopWidth;
				this.element.runtimeStyle.borderTopWidth = currentVal;
				var value = this.element.clientTop;
				this.element.runtimeStyle.borderTopWidth = runtimeStyleVal;
			} else { // length values
				var runtimeStyleVal = this.element.runtimeStyle.left;
				var styleVal = this.element.style.left;
				this.element.runtimeStyle.left = this.element.currentStyle.left;
				this.element.style.left = currentVal || 0;
				var value = this.element.style.pixelLeft;
				this.element.style.left = styleVal;
				this.element.runtimeStyle.left = runtimeStyleVal;
			}
			return value;
		}
		throw new Error('Cannot get computed element style.');
	},
	setCSSLength: function (property, length) {
		property = this._normalizeProperty(property);
		DOMUtils.setStyleProperty(this.element.style, property, length + 'px');
	},
	resetCSSLength: function (property) {
		property = this._normalizeProperty(property);
		DOMUtils.removeStyleProperty(this.element.style, property);
	},
	_normalizeProperty: function (property) {
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	isContentBoxDimensionAuto: function (axis) {
		// auto will not expand offset dimension with padding
		var temp = DOMUtils.getStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis]);
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '0px');
		var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '1px');
		var flag = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]] == dimension;
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], temp);
		return flag;
	}
}, {
	AXIS_DIMENSION: {vertical: 'height', horizontal: 'width'},
	AXIS_DIMENSION_UP: {vertical: 'Height', horizontal: 'Width'},
	AXIS_TL: {vertical: 'top', horizontal: 'left'},
	AXIS_BR: {vertical: 'bottom', horizontal: 'right'}
});

