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
 
var DOMUtils = {
	swapStyles: function (element, tempStyles, callback) {
//[TODO] runtimeStyle?
		var curStyles = {};
		forEach(tempStyles, function (value, prop) {
			curStyles[prop] = element.style[prop];
		});
		DOMUtils.setStyles(element, tempStyles);
		var ret = callback(element);
		DOMUtils.setStyles(element, curStyles);
		return ret;
	},
	//[TODO] support non-camel-case, maybe
	setStyles: function (element, styles) {
		forEach(styles, function (value, prop) {
			element.style[prop] = value;
		});
	},
	addStyles: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},
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
	addClass: function (element, className) {
		DOMUtils.removeClass(element, className);
		element.className += ' ' + className;
	},
	removeClass: function (element, className) {
		element.className = (' ' + (element.className || '') + ' ').replace(' ' + className + ' ', ' ');
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
		if (this.view.getComputedStyle)
			return parseFloat(this.view.getComputedStyle(this.element, null).getPropertyValue(property));
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
			var currentVal = this.element.currentStyle[this._toCamelCase(property)];
			if (property.match(/^(width|height)$/))
				return this._shiftDimension(this.getBoxDimension('padding', {width: 'horizontal', height: 'vertical'}[property]), 'padding', false);
			if (/^\d+(px)?$/i.test(currentVal) || currentVal == 'none')
				return parseFloat(currentVal) || 0;
			if (property.match(/^border/) && !(/^\d+/.test(currentVal))) { // border-named values
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
		this.element.style[this._toCamelCase(property)] = length + 'px';
	},
	resetCSSLength: function (property) {
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
		var temp = this.element.style['padding' + {horizontal: 'Left', vertical: 'Top'}[axis]];
		this.element.style['padding' + {horizontal: 'Left', vertical: 'Top'}[axis]] = 0;
		var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		this.element.style['padding' + {horizontal: 'Left', vertical: 'Top'}[axis]] = '1px';
		var flag = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]] == dimension;
		this.element.style['padding' + {horizontal: 'Left', vertical: 'Top'}[axis]] = temp;
		return flag;
	}
};

//----------------------------------------------------------------------
// node data manager
//----------------------------------------------------------------------

//[TODO] does this really require a prefix?
var NodeDataManager = Base.extend({
	prefix: '',
	constructor: function (prefix) {
		this.prefix = prefix || '';
	},
	get: function (node, key) {
		return this._getUserData(node, this.prefix + ':' + key);
	},
	set: function (node, key, data) {
		return this._setUserData(node, this.prefix + ':' + key, data, null);
	},
	has: function (node, key) {
		return this.get(node, key) != null;
	},
	remove: function (node, key) {
		this.set(node, key, null);
	},
	'_getUserData': function (node, key) {
		return node.getUserData(key);
	},
	'_setUserData': function (node, key, value, handler) {
		return node.setUserData(key, value, handler);
	}
});

if (!document.getUserData || !document.setUserData)
{
	// create our own data cache
	var userData = {}, userDataID = 0;
	NodeDataManager.implement({
		_getUserData: function (node, key) {
			if (typeof node['data-userDataKey'] == 'undefined')
				node['data-userDataKey'] = ++userDataID;
			return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
		},
		_setUserData: function (node, key, value, handler) {
			var old = this._getUserData(node, key);
			(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = value;
			return old;
		}
	});
}//----------------------------------------------------------------------
// orientation manager
//----------------------------------------------------------------------

var OrientationManager = base2.Base.extend({
	document: null,
	
	orientationData: new NodeDataManager('orientation'),
	constructor: function (document) {
		// save document reference
		if (!document || document.nodeType != 9)
			throw new Error('Invalid document reference supplied.');
		this.document = document;
		this.body = document.getElementsByTagName('body')[0];
		
		// add orientation styles
		DOMUtils.addStyles(document, [
			'.orientation-horizontal { overflow: hidden; width: 0; }',
			'.orientation-horizontal-child { float: left; width: 0; }',
		    ].join('\n'));
		   
		// create sizing anchor
		this.getContentSizeAnchor = document.createElement('a');
		DOMUtils.setStyles(this.getContentSizeAnchor, {display: 'block'});
	},
	
	getOrientation: function (element) {
		return (element && this.orientationData.get(element, 'orientation')) || 'vertical';
	},
	setOrientation: function (element, axis) {
		/* NOTE: orientation on body is possible, but float containment only works if
		   overflow is defined on the document element, not the body; disallow it for uniformity's sake */
		
		// validate element
		if (!element || element.nodeType != 1)
			throw new Error('Invalid DOM element supplied.');
		if (!DOMUtils.contains(this.body, element))
			throw new Error('Only descendants of the body element can have orientation.');
		if (this.getOrientation(element) == axis)
			return;
			
		// set data
		this.orientationData.set(element, 'orientation', axis == 'vertical' ? axis : 'horizontal');

		// flow requires some changes
		if (axis == 'horizontal')
		{
			// wrap child text nodes
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType != 3)
					continue;
				var wrap = this.document.createElement('span');
				DOMUtils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
				child = wrap;
			}
		
			// shrink-wrap child elements
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType != 1)
					continue;
					
				// shrink-wrap width: auto elements to minimum content width
				if ((new CSSBox(child)).isContentBoxDimensionAuto(axis))
					(new CSSBox(child)).setCSSLength('width', this.getMinContentWidth(element));
				// add class
				DOMUtils.addClass(child, 'orientation-horizontal-child');
			}
			
			// add class
			DOMUtils.addClass(element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			(new CSSBox(element)).setCSSLength('width', this.getContentSize(element, 'horizontal'));
		}
		else
		{
			// unwrap child text nodes
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType == 1 && child.className.indexOf('orientation-text') != -1)
					child.parentNode.replaceChild(child.firstChild, child);
			}
			
			// unshrink elements
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType != 1)
					continue;
				
				// unshrink elements
//[TODO]
				// remove class
				DOMUtils.removeClass(child, 'orientation-horizontal-child');
			}
			
			// remove class
			DOMUtils.removeClass(element, 'orientation-horizontal');
			// remove style
//[TODO]
			(new CSSBox(element)).resetCSSLength('width');
		}
	},
	
	// get minimum content width, for initial horizontal sizing
	'getMinContentWidth': function (element) {
		//[FIX] Safari doesn't like dimensions of '0'
		var box = new CSSBox(element);
		return DOMUtils.swapStyles(element, {width: '1px', overflow: 'auto'}, function () {
			return element.scrollWidth - box.getCSSLength('padding-left') - box.getCSSLength('padding-right');
		});
	},
	// min/max-content width for browsers that support the CSS property
	// in theory safari supports '(min-)intrinsic', but it's not equivalent
	'@Gecko': {
		'getMinContentWidth': function (element) {
			return DOMUtils.swapStyles(element, {width: '-moz-min-content'}, function () {
				return (new CSSBox(element)).getBoxDimension('content', 'horizontal');
			});
		}
	},
	
	// size of box content, depending on orientation
	getContentSizeAnchor: null,
	getContentSize: function (element, axis) {
		if (axis == 'vertical') {
			element.appendChild(this.getContentSizeAnchor);
			var size = (new CSSBox(this.getContentSizeAnchor))._getRoughOffset().y;
			element.insertBefore(this.getContentSizeAnchor, element.firstChild);
			size -= (new CSSBox(this.getContentSizeAnchor))._getRoughOffset().y;
			element.removeChild(this.getContentSizeAnchor);
			return size;
		} else {
			for (var size = 0, child = element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += (new CSSBox(child)).getBoxDimension('margin', axis);
			return size;
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
	layoutData: new NodeDataManager('layout'),

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
		// normalize properties and get axis
		property = this.normalizeProperty(property);
		var axis = this.getPropertyAxis(property);
		if (!axis || !this.layoutData.get(element, axis, false))
			return;
			
		// return data
		return this.layoutData.get(element, 'properties-' + axis)[property];
	},

	setFlexibleProperty: function (element, property, flex) {
		// validate element
		if (!element || (element.nodeType !== 1))
			throw new Error('Invalid DOM element supplied.');
		if (!DOMUtils.contains(this.root, element))
			throw new Error('Flexible elements must be descendants of the root node.');

		// normalize properties and get axis
		property = this.normalizeProperty(property);
		var axis = this.getPropertyAxis(property);
		if (!axis)
			return;

		// add flexible marker
		this.layoutData.set(element, axis, true);
		// set element property
		if (!this.layoutData.has(element, 'properties-' + axis))
			this.layoutData.set(element, 'properties-' + axis, {});
		var flexProperties = this.layoutData.get(element, 'properties-' + axis);
		flexProperties[property] = flex ? Math.max(parseInt(flex), 1) : 1;
	
		// recalculate element flex count
		var count = 0;
		for (var prop in flexProperties)
			count += flexProperties[prop];
		this.layoutData.set(element, 'count-' + axis, count);
		// recalculate parent flex count
		var count = 0, parent = element.parentNode;
		for (var child = parent.firstChild; child; child = child.nextSibling)
			if (this.layoutData.has(child, 'count-' + axis))
				count += this.layoutData.get(element, 'count-' + axis);
		this.layoutData.set(parent, 'parent-count-' + axis, count);
	},
	
	removeFlexibleProperty: function (element, property) {
		//[TODO] remove from flexProperties and remove marker
	},
	
	// private
	
	normalizeProperty: function (property) {
		// rewrite border properties
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	
	getPropertyAxis: function (property) {
		// property lists
		var flexPropertiesList = {
			horizontal: /^(width|(padding|margin)-(left|right)|border-(left|right)-width|left|right)$/,
			vertical: /^(height|(padding|margin)-(top|bottom)|border-(top|bottom)-width|top|bottom)$/
		};
		// get dimension axis
		for (var axis in flexPropertiesList)
			if (flexPropertiesList[axis].test(property))
				return axis;
		return false;
	},
	
	// layout calculation

	calculate: function ()
	{
		// reset layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				ascend: bind(function (parent) {
					// get any flexible children
					for (var children = [], child = parent.firstChild; child; child = child.nextSibling)
						if (this.layoutData.get(child, axis))
							children.push(child);
					if (!children.length)
						return;
					
					// reset/equalize nodes
					this.resetLayout(axis, parent, children);
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
				descend: bind(function (parent) {
					// get any flexible children
					for (var children = [], child = parent.firstChild; child; child = child.nextSibling)
						if (this.layoutData.get(child, axis))
							children.push(child);
					if (!children.length)
						return;
					
					// reset/equalize nodes
					this.expandLayout(axis, parent, children);
				}, this)
			});
	},
	
	updateFlexibleProperties: function (node, axis, unit) {
		// set flexible properties
		var flexProperties = this.layoutData.get(node, 'properties-' + axis), box = new CSSBox(node);
		for (var prop in flexProperties)
			box.setCSSLength((prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * flexProperties[prop]);
	},
	
	resetLayout: function (axis, parent, children) {
		// reset properties
		this.layoutData.set(parent, 'parent-unit-' + axis, 0);
		for (var i = 0; i < children.length; i++) {
			// reset flexible properties
			this.layoutData.set(children[i], 'unit-' + axis, 0);
			var flexProperties = this.layoutData.get(children[i], 'properties-' + axis), box = new CSSBox(children[i]);
			for (var prop in flexProperties)
				box.setCSSLength((prop.match(/^(width|height)$/) ? 'min-' : '') + prop, 0);
		}
	},

	expandLayout: function (axis, parent, children) {
		// calculate available free space in parent
		var contentSize, contentBoxSize, divisor, oldFlexUnit, newFlexUnit;
		// get content box size
		contentBoxSize = (new CSSBox(parent)).getBoxDimension('content', axis);
			
		// calculate flex unit (with flow)
		if (axis == this.getOrientation(parent)) {
			contentSize = this.getContentSize(parent, axis);
			divisor = this.layoutData.get(parent, 'parent-count-' + axis);
			oldFlexUnit = this.layoutData.get(parent, 'parent-unit-' + axis);
			
			// content box dimensions may be larger than flex unit; subtract from content size
			for (var i = 0; i < children.length; i++)
				if ({horizontal: 'width', vertical: 'height'}[axis] in this.layoutData.get(children[i], 'properties-' + axis))
					contentSize -= (new CSSBox(children[i])).getBoxDimension('content', axis) - oldFlexUnit;
		}
		
		// iterate flexible children
		for (var i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != this.getOrientation(parent)) {
				contentSize = (new CSSBox(children[i])).getBoxDimension('margin', axis);
				divisor = this.layoutData.get(children[i], 'count-' + axis);
				oldFlexUnit = this.layoutData.get(children[i], 'unit-' + axis);
				
				// content box dimensions may be larger than flex unit; subtract from content size
				if ({horizontal: 'width', vertical: 'height'}[axis] in this.layoutData.get(children[i], 'properties-' + axis))
					contentSize -= (new CSSBox(children[i])).getBoxDimension('content', axis) - oldFlexUnit;
			}
			
			// set flexible properties
//console.log('Content box size:', contentBoxSize, 'Content size:', contentSize, 'Divisor:', divisor, 'OldFlexUnit:', oldFlexUnit);
			var newFlexUnit = Math.max((contentBoxSize - (contentSize - (divisor * oldFlexUnit))) / divisor, 0);
			this.updateFlexibleProperties(children[i], axis, newFlexUnit);
			
			// cache flex unit (against flow)
			if (axis != this.getOrientation(parent))
				this.layoutData.set(children[i], 'unit-' + axis, newFlexUnit);
		}
		
		// cache flex unit (with flow)
		if (axis == this.getOrientation(parent))
			this.layoutData.set(parent, 'parent-unit-' + axis, newFlexUnit);
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