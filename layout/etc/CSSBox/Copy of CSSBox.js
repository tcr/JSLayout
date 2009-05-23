//----------------------------------------------------------------------
// CSS Box
//----------------------------------------------------------------------

function Rectangle(x, y, x2, y2) {
	this.left = x;
	this.top = y;
	this.right = x2;
	this.bottom = y2;
	this.width = x2 - x;
	this.height = y2 - y;
}

function CSSBox(element) {
	if (!element || element.nodeType !== 1)
		throw new Error('Invalid DOM element supplied.');
	this.element = element;
	this.view = DOMUtils.getOwnerDocument(element).defaultView || window;
}
CSSBox.AXIS_DIMENSION = {vertical: 'height', horizontal: 'width'};
CSSBox.AXIS_DIMENSION_UP = {vertical: 'Height', horizontal: 'Width'},
CSSBox.AXIS_TL = {vertical: 'top', horizontal: 'left'},
CSSBox.AXIS_BR = {vertical: 'bottom', horizontal: 'right'};
CSSBox.prototype = {
	getBorderBox: function () {
		if (this.element.getBoundingClientRect)
			var rect = this.element.getBoundingClientRect();
		else {
			// emulate getBoundingClientRect
//http://base2.googlecode.com/svn/trunk/src/base2/DOM/cssom/ElementView.js
		}
		return new Rectangle(rect.left, rect.top, rect.right, rect.bottom);
	},
	getContentBox: function () {
		var rect = this.getBorderBox(), top = rect.top, left = rect.left;
		top += this.getLength('border-top') + this.getLength('padding-top');
		left += this.getLength('border-left') + this.getLength('padding-left')
		return new Rectangle(top, left, top + this.getLength('height'), left + this.getLength('width'));
	},
	getMarginBox: function () {
		var box = this.getBorderBox();
		return new Rectangle(box.left - this.getLength('margin-left'), box.top - this.getCSSLength('margin-top'),
		    box.right + this.getLength('margin-right'), box.bottom + this.getLength('margin-bottom'));
	},
	getPaddingBox: function () {
		var box = this.getBorderBox();
		return new Rectangle(box.left + this.getLength('border-left'), box.top + this.getCSSLength('border-top'),
		    box.right - this.getLength('border-right'), box.bottom - this.getLength('border-bottom'));
	},
	getBorderBoxDimension: function (axis) {
		return this.getBorderBox()[CSSBox.AXIS_DIMENSION[axis]];
	},
	getContentBoxDimension: function (axis) {
		return this.getLength(CSSBox.AXIS_DIMENSION[axis]);
	},
	getMarginBoxDimension: function (axis) {
		return this.getBorderBoxDimension() + this.getLength('margin-' + CSSBox.AXIS_TL[axis]) + this.getLength('margin-' + CSSBox.AXIS_BR[axis]);
	},
	getPaddingBoxDimension: function (axis) {
		return this.getContentBoxDimension() + this.getLength('padding-' + CSSBox.AXIS_TL[axis]) + this.getLength('padding-' + CSSBox.AXIS_BR[axis]);
	},
	getLength: function (property) {
		property = this._normalizeProperty(property);
		if (this.view.getComputedStyle)
			return parseFloat(this.view.getComputedStyle(this.element, null).getPropertyValue(property));
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
//[TODO] support clientWidth/clientHeight
			var currentVal = this.element.currentStyle[this._toCamelCase(property)];
			if (/^\d+(px)?$/i.test(currentVal)) return parseFloat(currentVal);
			if (currentVal == 'none') return 0;
			var isBorder = property.match(/^border/), prop = isBorder ? 'borderLeft' : 'left';
			var runtimeStyleVal = this.element.runtimeStyle[prop];
			var styleVal = this.element.style[prop];
			this.element.runtimeStyle[prop] = isBorder ? currentVal : this.element.currentStyle[prop];
			this.element.style[prop] = currentVal || 0;
			var value = isBorder ? this.element.clientLeft : this.element.style.pixelLeft;
			this.element.style[prop] = styleVal;
			this.element.runtimeStyle[prop] = runtimeStyleVal;
			return value;
		}
		else
			throw new Error('Cannot get computed element style.');
	},
	setLength: function (property, length) {
		this.element.style[this._toCamelCase(property)] = length + 'px';
	},
	removeLength: function (property) {
//[TODO] is this function needed/correct?
		this.setLength(property, '');
	},
	_normalizeProperty: function (property) {
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	_toCamelCase: function (property) {
		return property.replace(/\-([a-z])/g, function (string, letter) { return letter.toUpperCase(); });
	},
	isContentBoxDimensionAuto: function (axis) {
		// auto will not expand offset dimension with padding
		var temp = this.element.style['padding' + CSSBox.AXIS_TL[axis]];
		this.element.style['padding' + CSSBox.AXIS_TL[axis]] = 0;
		var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		this.element.style['padding' + CSSBox.AXIS_TL[axis]] = '1px';
		var flag = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]] == dimension;
		this.element.style['padding' + CSSBox.AXIS_TL[axis]] = temp;
		return flag;
	}
}

