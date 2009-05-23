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
	_getBoundingClientRect: function () {
		var rect = this.element.getBoundingClientRect();
		return new Rectangle(rect.left, rect.top, rect.right, rect.bottom);
	}
	_shiftOffset: function (offset, prop, expand) {
		return {x: offset.x + this.getLength(prop + '-left')*(expand?-1:1), y: offset.y + this.getLength(prop + '-top')*(expand?-1:1)};
	},
	getBoxOffset: function (type) {
		// get rough offset
		if (this.element.getBoundingClientRect)
			var rect = this._getBoundingClientRect(), offset = {x: rect.left, y: rect.top};
		else {
			// offsetParents
			
		}
		switch (type) {
			'margin': return this._shiftOffset(offset, 'margin', true);
			'border': return offset;
			'padding': return this._shiftOffset(offset, 'border', false);
			'content': return this._shiftOffset(this._shiftOffset(offset, 'padding', true), 'margin', false);
		}
	},
	_shiftDimension: function (dimension, axis, prop, expand) {
		return dimension + (this.getLength(prop + '-' + AXIS_TL[axis]) + this.getLength(prop + '-' + AXIS_BR[axis]))*(expand?-1:1)
	},
	getBoxDimension: function (type, axis) {
		if (type == content)
			return this.getLength(CSSBox.AXIS_DIMENSION[axis]);
		var dimension = this.element.getBoundingClientRect ?
			this._getBoundingClientRect()[AXIS_DIMENSION[axis]] : this.element['offset' + AXIS_DIMENSION_UP[axis]];
		switch (type) {
			'margin': return this._shiftDimension(dimension, axis, 'margin', true);
			'border': return dimension;
			'padding': return this._shiftDimension(dimension, axis, 'border', false);
		}
	},
	_shiftBox: function (rect, prop, expand) {
		return new Rectangle(rect.left + this.getLength(prop + '-left')*(expand?-1:1), rect.top + this.getLength(prop + '-top')*(expand?-1:1),
		    rect.right - this.getLength(prop + '-right')*(expand?-1:1), rect.bottom - this.getLength(prop + '-bottom')*(expand?-1:1));
	}
	getBox: function (type) {
		if (this.element.getBoundingClientRect)
			var rect = this._getBoundingClientRect();
		else if (type == 'client') {
			var offset = this.getBoxOffset('client');
			return new Rectangle(offset.x, offset.y, offset.x + this.getLength('width'), offset.y + this.getLength('height'));
		} else
			var offset = this.getBoxOffset('border'), rect = new Rectangle(offset.x, offset.y,
			    offset.x + this.getBoxDimension('border', 'horizontal'), offset.y + this.getBoxDimension('border', 'vertical'))
		switch (type) {
			'margin': return this._shiftBox(rect, 'margin', true);
			'border': return rect;
			'padding': return this._shiftBox(rect, 'border', false);
		}
	},
	getLength: function (property) {
		property = this._normalizeProperty(property);
		if (this.view.getComputedStyle)
			return parseFloat(this.view.getComputedStyle(this.element, null).getPropertyValue(property));
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
//[TODO] support clientWidth/clientHeight
			var currentVal = this.element.currentStyle[this._toCamelCase(property)];
			if (/^\d+(px)?$/i.test(currentVal))
				return parseFloat(currentVal);
			if (currentVal == 'none')
				return 0;
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
};

