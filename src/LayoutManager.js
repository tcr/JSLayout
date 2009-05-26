//----------------------------------------------------------------------
// layout manager
//----------------------------------------------------------------------

var LayoutManager = OrientationManager.extend({
	root: null,
	cache: null,
	constructor: function (root) {
		// save root
		this.root = root;
		if (!root || root.nodeType != 1)
			throw new Error('Layout manager root must be an element.');
		// orientation manager constructor
		OrientationManager.call(this, DOMUtils.getOwnerDocument(root));
		
		// check root position
		if (!DOMUtils.isAncestorOf(this.body, root) && root != this.body)
			throw new Error('Root node must be a descendant of the body element or the body itself.');
		
		// create resize listener
		var observer = new ResizeObserver(root);
		observer.addListener(Utils.bind(this.recalculate, this));
		
		// create style cache
		this.cache = new LayoutStyleCache(this.document);
	},

	getFlexibleProperty: function (element, property) {
		// validate element
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		// return data
		return LayoutBoxChild.getFlexibleProperty(element, axis, property);
	},

	setFlexibleProperty: function (element, property, flex) {
		// validate element
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		if (!DOMUtils.isAncestorOf(this.root, element))
			throw new Error('Flexible elements must be descendants of the root node.');
			
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		flex = flex ? Math.max(parseInt(flex), 1) : 1
		// set element property
		LayoutBoxChild.setFlexibleProperty(element, axis, property, flex);
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
//[TODO] caching of layout objects

	calculate: function ()
	{
		// reset layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				ascend: Utils.bind(function (parent) {
					// reset layout
					var children = LayoutBox.getFlexibleChildren(parent, axis);
					if (children.length)
						LayoutBox.resetLayout(parent, children, axis, this);
				}, this)
			});
		this.cache.updateStyles();
		
		// initial recalculate
		this.recalculate();
	},
	
	recalculate: function ()
	{
		// recalculate layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				descend: Utils.bind(function (parent) {
					// calculate layout
					var children = LayoutBox.getFlexibleChildren(parent, axis);
					if (children.length)
						LayoutBox.calculateLayout(parent, children, axis, this);
				}, this)
			});
		this.cache.updateStyles();
	}
});

/*
 * style change cache
 */
 
var LayoutStyleCache = Structure.extend({
	cache: null,
	document: null,
	constructor: function (document) {
		this.document = document;
		this.cache = {};
	},
	
	queueStyleChange: function (node, prop, value) {
		if (!node.id)
			node.id = '_layout_style_cache_' + LayoutStyleCache.counter++;
		this.cache[node.id] = this.cache[node.id] || {};
		this.cache[node.id][prop] = value;
	},
	
	updateStyles: function () {
		// create the stylesheet content, like a bastardized innerCSS
		for (var id in this.cache) {
			var node = document.getElementById(id);
			var css = '';
			for (var prop in this.cache[id])
				css += prop + ': ' + this.cache[id][prop] + ';\n';
			node.style.cssText = css;
			
			delete this.cache[id];
		}
	}
}, {
	counter: 0
});

/*
 * layout boxes
 */
 
var LayoutData = new NodeUserData('layout');

var LayoutBox = {
	getFlexibleChildren: function (parent, axis) {
		// find flexible children (assume this doesn't expire for the lifespan on the object)
		for (var children = [], child = parent.firstChild, box; child; child = child.nextSibling)
			if (DOMUtils.isElement(child) && LayoutBoxChild.isFlexibleAlongAxis(child, axis))
				children.push(child);
		return children;
	},

	resetLayout: function (parent, children, axis, layout) {
		// reset parent flex unit
		LayoutData.set(parent, 'container-unit-' + axis, 0);
		// reset children properties
		for (var i = 0; i < children.length; i++) {
			// reset flexible properties
			LayoutData.set(children[i], 'unit-' + axis, 0);
			LayoutBoxChild.updateFlexibleProperties(children[i], axis, 0, layout);
		}
	},

	calculateLayout: function (parent, children, axis, layout) {
		// calculate available free space in parent
		var contentSize, contentBoxSize, divisor, oldFlexUnit, newFlexUnit;
		// get content box size (actual, or desired by flex)
		contentBoxSize = LayoutData.has(parent, 'content-size-cache-' + axis) ?
		    LayoutData.get(parent, 'content-size-cache-' + axis) :
		    BoxUtils.getBoxDimension(parent, 'content', axis);
			
		// calculate flex unit (with flow)
		if (axis == OrientationBox.getOrientation(parent)) {
			contentSize = OrientationBox.getContentSize(parent);
			divisor = LayoutData.get(parent, 'container-divisor-' + axis);
			oldFlexUnit = LayoutData.get(parent, 'container-unit-' + axis);
			
			// content box dimensions may be larger than flex unit; subtract from content size
			for (var i = 0; i < children.length; i++)
				if (LayoutBoxChild.hasFlexibleProperty(children[i], axis, BoxUtils.AXIS_DIMENSION[axis]))
					contentSize -= BoxUtils.getBoxDimension(children[i], 'content', axis) -
					    (oldFlexUnit * LayoutBoxChild.getFlexibleProperty(children[i], axis, BoxUtils.AXIS_DIMENSION[axis]));
		}
		
		// iterate flexible children
		for (var i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != OrientationBox.getOrientation(parent)) {
				contentSize = BoxUtils.getBoxDimension(children[i], 'margin', axis);
				divisor = LayoutData.get(children[i], 'divisor-' + axis);
				oldFlexUnit = LayoutData.get(children[i], 'unit-' + axis);
				
				// content box dimensions may be larger than flex unit; subtract from content size
				if (LayoutBoxChild.hasFlexibleProperty(children[i], axis, BoxUtils.AXIS_DIMENSION[axis]))
					contentSize -= BoxUtils.getBoxDimension(children[i], 'content', axis) -
					    (oldFlexUnit * LayoutBoxChild.getFlexibleProperty(children[i], axis, BoxUtils.AXIS_DIMENSION[axis]));
			}
			
			// set flexible properties
			var newFlexUnit = Math.max((contentBoxSize - (contentSize - (divisor * oldFlexUnit))) / divisor, 0);
			LayoutBoxChild.updateFlexibleProperties(children[i], axis, newFlexUnit, layout);
			
			// cache flex unit (against flow)
			if (axis != OrientationBox.getOrientation(parent))
				LayoutData.set(children[i], 'unit-' + axis, newFlexUnit);
		}
		
		// cache flex unit (with flow)
		if (axis == OrientationBox.getOrientation(parent))
			LayoutData.set(parent, 'parent-unit-' + axis, newFlexUnit);
	}
};

var LayoutBoxChild = {	
	getFlexibleProperty: function (element, axis, property) {
		return LayoutData.has(element, 'properties-' + axis) && LayoutData.get(element, 'properties-' + axis)[property];
	},
	
	hasFlexibleProperty: function (element, axis, property) {
		return LayoutData.has(element, 'properties-' + axis) && LayoutData.get(element, 'properties-' + axis).hasOwnProperty(property);
	},
	
	setFlexibleProperty: function (element, axis, property, value) {
		// update divisors
		var delta = value - (LayoutBoxChild.getFlexibleProperty(element, axis, property) || 0);
		LayoutData.set(element, 'divisor-' + axis, (LayoutData.get(element, 'divisor-' + axis) || 0) + delta);
		LayoutData.set(element.parentNode, 'container-divisor-' + axis,
		    (LayoutData.get(element.parentNode, 'container-divisor-' + axis) || 0) + delta);
		    
		// set property
		if (!LayoutData.has(element, 'properties-' + axis))
			LayoutData.set(element, 'properties-' + axis, {});
		LayoutData.get(element, 'properties-' + axis)[property] = value;
		
		//[FIX] for dimensions, we must be using content-box sizing
		if (property.match(/^(height|width)$/)) {
			CSSUtils.setStyleProperty(element.style, 'box-sizing', 'content-box');
			CSSUtils.setStyleProperty(element.style, '-moz-box-sizing', 'content-box');
			CSSUtils.setStyleProperty(element.style, '-webkit-box-sizing', 'content-box');
		}
	},
	
	isFlexibleAlongAxis: function (element, axis) {
		return LayoutData.has(element, 'divisor-' + axis) && (LayoutData.get(element, 'divisor-' + axis) > 0);
	},
	
	updateFlexibleProperties: function (element, axis, unit, layout) {
		// set flexible properties
		var properties = LayoutData.get(element, 'properties-' + axis) || {};
		for (var prop in properties)
			layout.cache.queueStyleChange(element, (prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * properties[prop] + 'px');
		
		// cache content-box size
		if (prop.match(/^(width|height)$/))
			LayoutData.set(element, 'content-size-cache-' + axis, unit * properties[prop]);
	}
};