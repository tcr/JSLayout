//----------------------------------------------------------------------
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
		DOMUtils.addStylesheet(document, [
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
					(new CSSBox(child)).setCSSLength('width', this.getMinContentWidth(child));
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

