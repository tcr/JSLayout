//----------------------------------------------------------------------
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
});