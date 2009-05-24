//------------------------------------------------------------------------------
// JS Layout Manager
// (c) Tim Cameron Ryan 2008-09
//------------------------------------------------------------------------------

new function(_) {
	var Layout = new base2.Package(this, {
		name:    'Layout',
		version: '1.0',
		imports: '',
		exports: 'LayoutManager,FullLayoutManager,OrientationManager'
	});
	
	eval(this.imports);

//----------------------------------------------------------------------
// DOM utilities
//----------------------------------------------------------------------

// DOMUtils vs. CSSUtils vs. Utils?
var DOMUtils = {
	// node manipulation
	getOwnerDocument: function (node) {
		return node.ownerDocument || node.document;
	},
	contains: function (parent, descendant) {
		parent.nodeType && descendant.nodeType;
		if (parent.compareDocumentPosition)
			return !!(parent.compareDocumentPosition(descendant) & 16);
		if (parent.contains)
			return parent != descendant && parent.contains(descendant);
		while (descendant && (descendant = descendant.parentNode) && parent != descendant)
			continue;
		return !!descendant;
	},
	
	// style object manipulation
	_toCamelCase: function (property) {
		return property.replace(/\-([a-z])/g, function (string, letter) { return letter.toUpperCase(); });
	},
	getStyleProperty: function (style, prop) {
		return style.getPropertyValue ? style.getPropertyValue(prop) : style[DOMUtils._toCamelCase(prop)];
	},
	setStyleProperty: function (style, prop, val) {
		style.setProperty ? style.setProperty(prop, val, null) : style[DOMUtils._toCamelCase(prop)] = val;
	},
	removeStyleProperty: function (style, prop) {
		style.removeProperty ? style.removeProperty(prop) : style[DOMUtils._toCamelCase(prop)] = '';
	},
	
	// style manipulation functions
	//[TODO] support non-camel-case, maybe
	swapStyles: function (element, tempStyles, callback) {
		var curStyles = {};
		forEach(tempStyles, function (value, prop) {
			curStyles[prop] = DOMUtils.getStyleProperty(element.style, prop);
		});
		DOMUtils.setStyles(element, tempStyles);
		var ret = callback(element);
		DOMUtils.setStyles(element, curStyles);
		return ret;
	},
	setStyles: function (element, styles) {
		forEach(styles, function (value, prop) {
			DOMUtils.setStyleProperty(element.style, prop, value);
		});
	},
	addStylesheet: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},

	// class attribute manipulation
	addClass: function (element, className) {
		DOMUtils.removeClass(element, className);
		element.className += ' ' + className;
	},
	removeClass: function (element, className) {
		element.className = (' ' + (element.className || '') + ' ').replace(' ' + className + ' ', ' ');
	},
	hasClass: function (element, className) {
		return (' ' + (element.className || '') + ' ').indexOf(' ' + className + ' ') != -1;
	}
};//----------------------------------------------------------------------
// CSS Box
//----------------------------------------------------------------------

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
			if (/KTML|Webkit/i.test(navigator.userAgent) && property == 'margin-right' &&
			    computedStyle.getPropertyValue('float') == 'none')
				return Math.max(parseFloat(DOMUtils.swapStyles(this.element, {'margin-left': 'auto'}, bind(function () {
					return this.view.getComputedStyle(this.element, null).getPropertyValue(property);
				}, this))), 0);
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
		DOMUtils.setStyleProperty(this.element.style, this._normalizeProperty(property), length + 'px')
	},
	resetCSSLength: function (property) {
		DOMUtils.removeStyleProperty(this.element.style, this._normalizeProperty(property))
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
};

//----------------------------------------------------------------------
// node user data manager
//----------------------------------------------------------------------

//[TODO] could prefixes be randomly generated? or eliminated...
var NodeUserData = Base.extend({
	node: null,
	prefix: '',
	constructor: function (node, prefix) {
		if (!node || !node.nodeType)
			throw new Error('Invalid DOM node supplied.');
		this.node = node;
		this.prefix = prefix ? prefix + ':' : '';
	},
	get: function (key) {
		return NodeUserData.getUserData(this.node, this.prefix + key);
	},
	set: function (key, data) {
		return NodeUserData.setUserData(this.node, this.prefix + key, data, null);
	},
	has: function (key) {
		return this.get(key) != null;
	},
	remove: function (key) {
		this.set(key, null);
	},
	ensure: function (key, defaultValue) {
		if (!this.has(key))
			this.set(key, defaultValue);
	}
}, {
	'getUserData': function (node, key) {
		return node.getUserData(key);
	},
	'setUserData': function (node, key, value, handler) {
		return node.setUserData(key, value, handler);
	}
});

if (!document.getUserData || !document.setUserData)
{
	// create our own data cache
	var userData = {}, userDataID = 0;
	NodeUserData.getUserData = function (node, key) {
		if (typeof node['data-userDataKey'] == 'undefined')
			node['data-userDataKey'] = ++userDataID;
		return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
	};
	NodeUserData.setUserData = function (node, key, value, handler) {
		var old = NodeUserData.getUserData(node, key);
		(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = value;
		return old;
	};
}//----------------------------------------------------------------------
// orientation manager
//----------------------------------------------------------------------

var OrientationManager = base2.Base.extend({
	document: null,
	constructor: function (document) {
		// save document reference
		if (!document || document.nodeType != 9)
			throw new Error('Invalid document reference supplied.');
		this.document = document;
		this.body = document.getElementsByTagName('body')[0];
		
		// add orientation styles
		DOMUtils.addStylesheet(document, [
			'.orientation-horizontal { overflow: hidden; width: 0; }',
			'.orientation-horizontal-child { float: left; width: 0; }',
		    ].join('\n'));
	},
	
	getOrientation: function (element) {
		return (new OrientationBox(element)).getOrientation();
	},
	setOrientation: function (element, axis) {
		/* NOTE: orientation on body is possible, but float containment only works if
		   overflow is defined on the document element, not the body; disallow it for uniformity's sake */
		
		// initialize
		var parent = new OrientationBox(element);
		// validate element
		if (!DOMUtils.contains(this.body, element))
			throw new Error('Only descendants of the body element can have orientation.');
		// set orientation
		parent.setOrientation(axis == 'horizontal' ? axis : 'vertical');
	}
});

/*
 * orientation boxes
 */
 
var LayoutBase = Abstract.extend({
	document: null,
	element: null,
	box: null,
	data: null,
	constructor: function (element) {
		if (!element || element.nodeType != 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.document = DOMUtils.getOwnerDocument(element);
		this.box = new CSSBox(element);
		this.data = new NodeUserData(element, 'layout');
	}
});
 
var OrientationBox = LayoutBase.extend({
	getOrientation: function () {
		return this.data.has('orientation') ? this.data.get('orientation') : 'vertical';
	},
	setOrientation: function (axis) {
		// set data (if axis has changed)
		if (this.getOrientation() == axis)
			return;
		this.data.set('orientation', axis);
		
		// orientation requires some changes
		if (axis == 'horizontal')
		{
			// wrap child text nodes
			this.containChildTextNodes();
			// update child elements
			for (var child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					(new OrientationBoxChild(child)).updateOrientation(axis);
			
			// add class
			DOMUtils.addClass(this.element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			this.box.setCSSLength('width', this.getContentSize());
		}
		else
		{
			// unwrap child text nodes
			this.restoreChildTextNodes();
			// update child elements
			for (var child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					(new OrientationBoxChild(child)).updateOrientation(axis);
			
			// remove class and styles
			DOMUtils.removeClass(element, 'orientation-horizontal');
			this.box.resetCSSLength('width');
		}
	},
	
	containChildTextNodes: function () {
		// wrap child text nodes in span elements
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 3) {
				var wrap = this.document.createElement('span');
				DOMUtils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
				child = wrap;
			}
		}		
	},
	restoreChildTextNodes: function () {
		// undo child text node wrapping
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 1 && DOMUtils.hasClass(child, 'orientation-text')) {
				child = child.firstChild;
				child.parentNode.parentNode.replaceChild(child, child.parentNode);
			}
		}
	},
	
//[TODO] other ways of doing this? particularly horizontally...
	// size of box content, depending on orientation
	getContentSize: function () {
		if (this.getOrientation() == 'vertical') {
			var anchor = this.document.createElement('span'), box = new CSSBox(anchor);
			DOMUtils.setStyleProperty(anchor.style, 'block');
			this.element.appendChild(anchor);
			var size = box._getRoughOffset().y;
			this.element.insertBefore(anchor, this.element.firstChild);
			size -= box._getRoughOffset().y;
			this.element.removeChild(anchor);
			return size;
		} else {
			for (var size = 0, child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += (new CSSBox(child)).getBoxDimension('margin', 'horizontal');
			return size;
		}
	}
});

var OrientationBoxChild = LayoutBase.extend({
	updateOrientation: function (axis) {
		if (axis == 'horizontal') {
			// set class
			DOMUtils.addClass(this.element, 'orientation-horizontal-child');
		
			// if box doesn't have fixed with, shrink horizontally
			if (this.box.isContentBoxDimensionAuto(axis))
				this.box.setCSSLength('width', this.getMinContentWidth());
			this.data.set('horizontal-shrink', true);
		} else {
			// unset class
			DOMUtils.removeClass(this.element, 'orientation-horizontal-child');
	
			// undo horizontal shrinkage
			if (this.data.get('horizontal-shrink'))
				this.box.resetCSSLength('width');
			this.data.set('horizontal-shrink', false)
		}
	},

//[TODO] other ways of doing this?
	// get minimum content width, for initial horizontal sizing
	'getMinContentWidth': function () {
		//[FIX] Safari doesn't like dimensions of '0'
		return DOMUtils.swapStyles(this.element, {width: '1px', overflow: 'auto'}, bind(function () {
			return this.element.scrollWidth - this.box.getCSSLength('padding-left') - this.box.getCSSLength('padding-right');
		}, this));
	},
	// min/max-content width for browsers that support the CSS property
	// in theory safari supports '(min-)intrinsic', but it's not equivalent
	'@Gecko': {
		'getMinContentWidth': function () {
			return DOMUtils.swapStyles(this.element, {width: '-moz-min-content'}, bind(function () {
				return this.box.getBoxDimension('content', 'horizontal');
			}, this));
		}
	}
});
//----------------------------------------------------------------------
// resize observer
//----------------------------------------------------------------------

// node resize polling function (can't trust window.resize cross-browser)

var ResizeObserver = Base.extend({
	constructor: function (node) {
		this.node = node;
		this.refresh();
		
		// add polling function
		setInterval(bind(this.poll, this), 250);
	},
	
	node: null,
	width: 0,
	height: 0,
	getDimension: function (dimension) {
		// clientWidth/Height will not include scrollbars
		return this.node['client' + dimension];
	},
	refresh: function () {
		this.width = this.getDimension('Width');
		this.height = this.getDimension('Height');
	},
	poll: function () {
		// compare window size
		if (this.width != this.getDimension('Width') || this.height != this.getDimension('Height')) {
			for (var i = 0; i < this.listeners.length; i++)
				this.listeners[i](this);
		}
		// update cache
		this.refresh();
	},
	listeners: [],
	addListener: function (listener) {
		this.listeners.push(listener);
	}
});//----------------------------------------------------------------------
// simple element traversal
//----------------------------------------------------------------------

var ElementTraversal = Module.extend({
	traverse: function (root, handlers) {
		// sanitize input
		if (!root || root.nodeType != 1)
			return;
		handlers = handlers || {};

		// traverse nodes
		var nodes = root.getElementsByTagName('*'), node = root, next, parent, i = 0;
		do {
			handlers.current && handlers.current(node);
			if (next = nodes[i++]) {
				if (node == (parent = next.parentNode))
					handlers.descend && handlers.descend(node)
				else if (handlers.ascend)
					while ((node = node.parentNode) != parent)
						handlers.ascend(node);
			}
			else if (handlers.ascend)
				while ((node != root) && (node = node.parentNode))
					handlers.ascend(node);
		} while (node = next);
	}
});//----------------------------------------------------------------------
// layout manager
//----------------------------------------------------------------------

var LayoutManager = OrientationManager.extend({
	root: null,
	constructor: function (root) {
		// save root
		this.root = root;
		if (!root || root.nodeType != 1)
			throw new Error('Layout manager root must be an element.');
		// orientation manager constructor
		this.base(DOMUtils.getOwnerDocument(root));
		
		// check root position
		if (!DOMUtils.contains(this.body, root) && root != this.body)
			throw new Error('Root node must be a descendant of the body element or the body itself.');
		
		// create resize listener
		var observer = new ResizeObserver(root);
		observer.addListener(bind(this.recalculate, this));
	},

	getFlexibleProperty: function (element, property) {
		// initialize
		var box = new LayoutBox(element);
		
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		// return data
		return box.getFlexibleProperty(axis, property);
	},

	setFlexibleProperty: function (element, property, flex) {
		// initialize
		var box = new LayoutBox(element);
		// validate element
		if (!DOMUtils.contains(this.root, element))
			throw new Error('Flexible elements must be descendants of the root node.');
			
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		flex = flex ? Math.max(parseInt(flex), 1) : 1
		// set element property
		box.setFlexibleProperty(axis, property, flex);
	},
	
	removeFlexibleProperty: function (element, property) {
		//[TODO] remove from flexProperties and remove marker
	},
	
	// private
	
	_normalizeProperty: function (property) {
		// rewrite border properties
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	
	_getPropertyAxis: function (property) {
		if (/^(width|(padding|margin)-(left|right)|border-(left|right)-width|left|right)$/.test(property))
			return 'horizontal';
		if (/^(height|(padding|margin)-(top|bottom)|border-(top|bottom)-width|top|bottom)$/.test(property))
			return 'vertical';
		return false;
	},
	
	// layout calculation

	calculate: function ()
	{
		// reset layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				ascend: bind(function (parentNode) {
					// reset/equalize nodes
					var parent = new LayoutContainer(parentNode, this);
					if (parent.hasFlexibleChildren(axis))
						parent.resetContainerLayout(axis);
				}, this)
			});
		
		// initial recalculate
		this.recalculate();
	},
	
	recalculate: function ()
	{
		// recalculate layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				descend: bind(function (parentNode) {
					// expand nodes
					var parent = new LayoutContainer(parentNode, this);
					if (parent.hasFlexibleChildren(axis))
						parent.expandContainerLayout(axis);
				}, this)
			});
	}
});

/*
 * layout boxes
 */

var LayoutContainer = OrientationBox.extend({
	children: null,
	constructor: function () {
		// construct layout box
		this.base.apply(this, arguments);
		
		// find flexible children (assume this doesn't expire for the lifespan on the object)
		this.children = {horizontal: [], vertical: []};
		for (var child = this.element.firstChild, box; child; child = child.nextSibling)
			for (var axis in this.children)
				if (child.nodeType == 1 && (box = new LayoutBox(child)).isFlexibleAlongAxis(axis))
					this.children[axis].push(box);
	},
	
	hasFlexibleChildren: function (axis) {
		return this.children[axis].length > 0;
	},
	
	updateDivisor: function (axis) {
		// set flexible properties
		var divisor = 0;
		for (var children = this.children[axis], i = 0; i < children.length; i++)
			divisor += children[i].data.get('divisor-' + axis);
		this.data.set('container-divisor-' + axis, divisor);
	},

	resetContainerLayout: function (axis) {
		// reset parent flex unit
		this.data.set('container-unit-' + axis, 0);
		// reset children properties
		for (var children = this.children[axis], i = 0; i < children.length; i++) {
			// reset flexible properties
			children[i].data.set('unit-' + axis, 0);
			children[i].updateFlexibleProperties(axis, 0);
		}
	},

	expandContainerLayout: function (axis) {
		// calculate available free space in parent
		var AXIS_DIMENSION = {horizontal: 'width', vertical: 'height'};
		var contentSize, contentBoxSize, divisor, oldFlexUnit, newFlexUnit;
		// get content box size
		contentBoxSize = this.box.getBoxDimension('content', axis);
			
		// calculate flex unit (with flow)
		if (axis == this.getOrientation()) {
			contentSize = this.getContentSize();
			divisor = this.data.get('container-divisor-' + axis);
			oldFlexUnit = this.data.get('container-unit-' + axis);
			
			// content box dimensions may be larger than flex unit; subtract from content size
			for (var children = this.children[axis], i = 0; i < children.length; i++)
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= children[i].box.getBoxDimension('content', axis) -
					    (oldFlexUnit * children[i].getFlexibleProperty(axis, AXIS_DIMENSION[axis]));
		}
		
		// iterate flexible children
		for (var children = this.children[axis], i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != this.getOrientation()) {
				contentSize = children[i].box.getBoxDimension('margin', axis);
				divisor = children[i].data.get('divisor-' + axis);
				oldFlexUnit = children[i].data.get('unit-' + axis);
				// content box dimensions may be larger than flex unit; subtract from content size
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= children[i].box.getBoxDimension('content', axis) -
					    (oldFlexUnit * children[i].getFlexibleProperty(axis, AXIS_DIMENSION[axis]));
			}
			
			// set flexible properties
			var newFlexUnit = Math.max((contentBoxSize - (contentSize - (divisor * oldFlexUnit))) / divisor, 0);
			children[i].updateFlexibleProperties(axis, newFlexUnit);
			
			// cache flex unit (against flow)
			if (axis != this.getOrientation())
				children[i].data.set('unit-' + axis, newFlexUnit);
		}
		
		// cache flex unit (with flow)
		if (axis == this.getOrientation())
			this.data.set('parent-unit-' + axis, newFlexUnit);
	}
});

var LayoutBox = LayoutBase.extend({	
	getFlexibleProperty: function (axis, property) {
		return this.data.has('properties-' + axis) && this.data.get('properties-' + axis)[property];
	},
	
	hasFlexibleProperty: function (axis, property) {
		return this.data.has('properties-' + axis) && this.data.get('properties-' + axis).hasOwnProperty(property);
	},
	
	setFlexibleProperty: function (axis, property, value) {
		this.data.ensure('properties-' + axis, {});
		this.data.get('properties-' + axis)[property] = value;
		this.data.set('is-flexible-' + axis, true);
		// reset flex count
		this.updateDivisor(axis);
		(new LayoutContainer(this.element.parentNode)).updateDivisor(axis);
	},

	updateDivisor: function (axis) {
		// set flexible properties
		var properties = this.data.get('properties-' + axis) || {}, divisor = 0;
		for (var prop in properties)
			divisor += properties[prop];
		this.data.set('divisor-' + axis, divisor);
	},
	
	isFlexibleAlongAxis: function (axis) {
		return !!this.data.get('is-flexible-' + axis);
	},
	
	updateFlexibleProperties: function (axis, unit) {
		// set flexible properties
		var properties = this.data.get('properties-' + axis) || {};
		for (var prop in properties)
			this.box.setCSSLength((prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * properties[prop]);
	}
});//----------------------------------------------------------------------
// full-page layout manager
//----------------------------------------------------------------------

var FullLayoutManager = LayoutManager.extend({
	constructor: function (document, overflow) {
		// make document elements full-page
		var html = document.documentElement, body = document.getElementsByTagName('body')[0];
		DOMUtils.setStyles(html, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: overflow || 'hidden'});
		DOMUtils.setStyles(body, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: 'visible'});

		// construct manager
		this.base(body);
	}
});

//------------------------------------------------------------------------------
// package
//------------------------------------------------------------------------------

	eval(this.exports);
};

//