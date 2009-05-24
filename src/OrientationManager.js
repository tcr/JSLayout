//----------------------------------------------------------------------
// orientation manager
//----------------------------------------------------------------------

var OrientationManager = Base.extend({
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
		/* NOTE: orientation on body is possible, but float containment only works in Mozilla if
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
 
//@abstract
var LayoutBase = Base.extend({
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
		
		// wrap or unwrap child text nodes
		axis == 'horizontal' ? this.containChildTextNodes() : this.restoreChildTextNodes();
		// update child elements
		for (var child = this.element.firstChild; child; child = child.nextSibling)
			if (child.nodeType == 1)
				(new OrientationBoxChild(child)).updateOrientation(axis);
			
		// classes, styles
		if (axis == 'horizontal') {
			// add class
			DOMUtils.addClass(this.element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			this.box.setCSSLength('width', this.getContentSize());
		} else {
			// remove class and styles
			DOMUtils.removeClass(this.element, 'orientation-horizontal');
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
		// min/max-content width for browser that support the CSS property
		//[NOTE] in theory safari supports '(min-)intrinsic', but it's not equivalent
		if (DOMUtils.isUserAgent(/Gecko/i)) {
			return DOMUtils.swapStyles(this.element, {width: '-moz-min-content'}, bind(function () {
				return this.box.getBoxDimension('content', 'horizontal');
			}, this));
		}
	
		//[FIX] Safari doesn't like dimensions of '0'
		return DOMUtils.swapStyles(this.element, {width: '1px', overflow: 'auto'}, bind(function () {
			return this.element.scrollWidth - this.box.getCSSLength('padding-left') - this.box.getCSSLength('padding-right');
		}, this));
	}
});
