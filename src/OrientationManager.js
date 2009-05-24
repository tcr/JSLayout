//----------------------------------------------------------------------
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
		if (parent.getOrientation() == axis)
			return;
		
		// set orientation
		axis = (axis == 'horizontal') ? axis : 'vertical';
		parent.setOrientation(axis);

		// flow requires some changes
		if (axis == 'horizontal')
		{
			// wrap child text nodes
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType == 3) {
					var wrap = this.document.createElement('span');
					DOMUtils.addClass(wrap, 'orientation-text');
					child.parentNode.replaceChild(wrap, child);
					wrap.appendChild(child);
					child = wrap;
				}
			}
		
			// shrink-wrap child elements
			for (var child = element.firstChild; child; child = child.nextSibling) {
				if (child.nodeType == 1) {
					// shrink-wrap width: auto elements to minimum content width
					var childBox = new CSSBox(child);
					if (childBox.isContentBoxDimensionAuto(axis))
						childBox.setCSSLength('width', this.getMinContentWidth(child));
					// add class
					DOMUtils.addClass(child, 'orientation-horizontal-child');
				}
			}
			
			// add class
			DOMUtils.addClass(element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			parent.box.setCSSLength('width', parent.getContentSize());
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
			parent.box.resetCSSLength('width');
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
		this.data.set('orientation', axis);
	},
	
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
