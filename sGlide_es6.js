/*global window:false, console:false, document:false, event:false, jQuery:false */

/***********************************************************************************

author:		Daniel B. Kazmer (webshifted.com)
created:	24.11.2012
version:	3.1.0

	version history:
		3.2.0	added preSnap - checks whether hard or soft snap is enabled, presnapping to nearest snap point on ready; start snap points at 2 (20.02.2019)
		3.1.0	retina setting default set to false (15.02.2018)
		3.0.0	added 'load' method in favour of 'onload' prop; removed CustomEvent polyfill; all callbacks now receive sGlide context; removed custom element getter to favour querySelectorAll; added resize support; removed orientation-change support; restored 'custom' property to output on ready; rebuilt snapmarks & more accurate snapping; other minor snap improvements & bug fixes; refactoring and general bug fixes; better 'css' & 'extend' functions; removed showKnob to favour noHandle; fixed 'return' on keyboard.shift; added Ctrl key option (11.01.2018)
		2.3.0	add 2 extra snap points to the previous maximum for the ability to snap every 10% at user request (24.04.2017)
		2.2.0	added snap sensitivity - accepts decimal values between 1 & 3 inclusive
		2.1.2	bug fix: text inputs were not selectable by mouse-drag in Chrome for jQuery - a proper if statement in the document's mousemove event listener solved it, thereby possibly increasing performance (applied to both jQuery and standalone) (01.02.2015)
		2.1.1	bug fix: clicking anywhere on bar didn't update value; nor did it update color in follow bar, for which a couple of constraint issues were also fixed (24.01.2015)
		2.1.0	removed snap properties hard & onlyOnDrop in favour of snap.type; also snap.markers became snap.marks; added totalRange property & runtime values thereof returned; destroy method now chainable for jQuery; fixed minor scoping issue; modified colorShift handling; significant changes with regards to data entered and data received; replaced setInterval with event listener (+ IE polyfill); removed drag and drop callbacks from initiator function; added slider data to onload callback; jQuery: removed unnecessary removeEventListeners for IE that caused an error on destroy (16.11.2014)
		2.0.0	major improvements in code structure, stability, accuracy; changed color shift property (see usage); only corresponding arrow keys for horizontal or vertical; added windows phone support; added retina image handling; fixed issues in destroy method; added shift + arrow keys (28.10.2014)
		1.10.0	added keyboard functionality (03.01.2014)
		1.9.1	bug fix: when button is pressed but released off button, button action now gets cleared (19.12.2013)
		1.9.0	added -/+ buttons, along with the onButton and onload callbacks (18.12.2013)
		1.8.8	stability (some distortion resistance); better rebuild on mobile; mobile orientation change support (09.12.2013)
		1.8.7	snap marks now align to snap points; bug fix: vertical now rebuilds properly (03.12.2013)
		1.8.5	mobile ready; added onSnap callback (02.12.2013)
		1.7.1	added real snapping and reworked its options; added "destroy" method - now allows clean rebuild; bug fix: when shell is thinner than knob, knob didn't retain its position in vertical mode (28.11.2013)
		1.5.0	added loadbar capability and "animated" option (27.11.2013)
		1.0.0	added Vertical mode; added option to hide knob (26.11.2013)
		0.3.1	more accurate snap markers; added color shifting (25.07.2013)
		0.2.6	bug fix: constraints when dragging (20.12.2012)
		0.2.5	bug fix: when knob is image, startAt now gets the correct knob width (13.12.2012)
		0.2.0	added disabled state (08.12.2012)
		0.1.0	created

	usage:
		pass an empty DIV, my_element, with a unique id to the following class

		var my_sGlide_instance = new sGlide(my_element, {
			startAt: 60,			// start slider knob at - default: 0
			image: ''				// string - image path
			retina: true,			// boolean - larger knob image with suffix @2x for retina displays
			width: 200,				// integer - default: 100
			height: 20,				// integer - default: 40
			unit: 'px',				// 'px' or '%' (default)
			pill:					// boolean - default: true
			snap: {
				marks		: false,
				type		: false,
				points		: 0,
				sensitivity	: 0
			},
			disabled:				// boolean - default: false
			colorShift:				// array of 2 css color values
			vertical:				// boolean - default: false
			noHandle:				// boolean - default: false
			buttons:				// boolean - default: false
			drop/drag/onSnap/onButton: function(o){
				console.log('returned object',o);
			}
		});

		all properties are optional, however, to retrieve data, use one of the callbacks

	goals:
		- fixes or implementations of these issues: http://stackoverflow.com/search?q=sglide

***********************************************************************************/

function sGlide(self, options){

	//------------------------------------------------------------------------------------------------------------------------------------
	// global variables

	var that			= this;
	var THE_VALUE		= 0,
		knob			= null,
		follow			= null,
		path			= '',
		isMobile		= false,
		buttons			= false,
		keyCtrl			= false,
		keyCtrlCtrl		= false,
		keyCtrlShift	= false,
		colorChangeBln	= false;
		// events
	var eventDocumentMouseUp	= null,
		eventDocumentMouseMove	= null,
		eventDocumentMouseDown	= null,
		eventDocumentKeyUp		= null,
		eventDocumentKeyDown	= null,
		eventKnobMouseUp		= null,
		eventKnobMouseDown		= null,
		eventWindowResize		= null,
		eventBarMouseDown		= null,
		eventPlusMinusMouseUp	= null,
		eventPlusMouseDown		= null,
		eventMinusMouseDown		= null;
		// event states prelim
	var mEvt	= {
			'down'	: 'mousedown',
			'up'	: 'mouseup',
			'move'	: 'mousemove'
		}
		uAgent = navigator.userAgent;

	this.element = self;

	//------------------------------------------------------------------------------------------------------------------------------------
	// public methods

	this.destroy = () => {
		const guid = self.getAttribute('id');

		// unwrap vertical buttons
		const vertContainer = $('#'+guid+'_vert-marks')[0];
		if (vertContainer){
			const vertParent = vertContainer.parentNode;
			vertParent.insertBefore(self, vertContainer.nextSibling);
			vertParent.removeChild(vertContainer);
		}

		const markers = $('#'+guid+'_markers')[0];
		if (markers) markers.parentNode.removeChild(markers);

		if (isMobile){
			document.removeEventListener(mEvt.down, eventDocumentMouseDown);
		} else if (keyCtrl || keyCtrlShift || keyCtrlCtrl){
			document.removeEventListener('keydown', eventDocumentKeyDown);
			document.removeEventListener('keyup', eventDocumentKeyUp);
		}

		// remove buttons
		if (buttons){
			const plus = $('#'+guid+'_plus')[0], minus = $('#'+guid+'_minus')[0];
			const buttonsParent = plus.parentNode;
			plus.removeEventListener(mEvt.up, eventPlusMinusMouseUp);
			plus.removeEventListener(mEvt.down, eventPlusMouseDown);
			minus.removeEventListener(mEvt.up, eventPlusMinusMouseUp);
			minus.removeEventListener(mEvt.down, eventMinusMouseDown);
			buttonsParent.removeChild(plus);
			buttonsParent.removeChild(minus);
			// unwrap
			if (!vertContainer){
				const buttonsContainer = $('#'+guid+'_button-marks')[0];
				if (buttonsContainer){
					const buttonsContainerParent = buttonsContainer.parentNode;
					buttonsContainerParent.insertBefore(buttonsContainer.childNodes[0], buttonsContainer.nextSibling);
					buttonsContainerParent.removeChild(buttonsContainer);
				}
			}
		}

		document.removeEventListener(mEvt.move, eventDocumentMouseMove);
		document.removeEventListener(mEvt.up, eventDocumentMouseUp);
		window.removeEventListener('resize', eventWindowResize);
		self.removeEventListener(mEvt.down, eventBarMouseDown);
		self.removeChild(knob);
		self.removeChild(follow);
		self.removeAttribute('style');
		self.removeAttribute('data-state');
		self.classList.remove('vertical');

		for (var i in this) delete this[i];
	};

	this.startAt = pct => {
		THE_VALUE = pct;

		// set pixel positions
		const selfWidth = self.offsetWidth;
		const knobWidth = knob.offsetWidth;

		// constraints
		if (pct <= 0)			pct = 0;
		else if (pct >= 100)	pct = 100;

		// set pixel positions
		const px = (selfWidth - knobWidth) * pct / 100 + (knobWidth / 2);
		const pxAdjust = px - (knobWidth / 2);

		// gui
		knob.style.left = pxAdjust+'px';
		follow.style.width = px+'px';

		// color shifting
		if (colorChangeBln)
			follow.children[0].style.opacity = pct / 100;

		return this;
	};

	var callback = null;
	const notifier = fn => callback = fn;
	self.addEventListener('sGlide.ready', data => {if (callback) callback.call(that, data.detail)});
	this.load = notifier;

	//------------------------------------------------------------------------------------------------------------------------------------
	// private global functions

	// const $ = name => document.querySelectorAll(name);
	const $ = name => document.querySelectorAll(name);

	const wrapAll = (elements, wrapperStr) => {
		// set wrapper element
		const a = document.createElement('div');
		a.innerHTML = wrapperStr;
		const wrapperEl = a.childNodes[0];
		elements[0].parentNode.insertBefore(wrapperEl, elements[0]);

		// append it
		for (var i = 0; i < elements.length; i++) wrapperEl.appendChild(elements[i]);
	};

	const clone = obj => {
		if (obj === null || typeof(obj) != 'object') return obj;

		var temp = obj.constructor(); // changed

		for (var key in obj){
			if (obj.hasOwnProperty(key)){
				temp[key] = clone(obj[key]);
			}
		}

		return temp;
	};

	const extend = (defaults, options) => {
		for (key in options){
			let val = options[key];
			if (val && val.constructor && val.constructor.name === 'Object'){
				defaults[key] = options[key] = extend(defaults[key], val);
			}
		}

		return Object.assign(defaults, options);
	};

	const css = (el, styles, prefixes) => {
		var cssString = '';

		if (prefixes){
			let temp = {};
			for (let key in styles){
				if (styles.hasOwnProperty(key)){
					for (let prefix of prefixes){
						temp[prefix+key] = styles[key];
					}
				}
			}
			styles = temp;
		}

		for (let key in styles){
			if (styles.hasOwnProperty(key)){
				cssString += key + ':' + styles[key] + ';';
			}
		}

		el.style.cssText += ';' + cssString;
	};

	{

		//------------------------------------------------------------------------------------------------------------------------------------
		// validate params

		if (self instanceof Element === false) throw new Error('sGlide: first param expected object<Element>, found '+(typeof self));
		if (options instanceof Object === false) throw new Error('sGlide: second param expected object, found '+(typeof options));

		//------------------------------------------------------------------------------------------------------------------------------------
		// build skeleton

		let guid = self.id;

		// no id? give one!
		if (!guid) guid = self.id = 'sglide-'+Math.random(1, 999);

		// add assets
		self.innerHTML = '<div class="follow_bar"></div><div class="slider_knob"></div>';

		if (self.children[0].className == 'slider_knob'){
			knob = self.children[0];
			follow = self.children[1];
		} else {
			knob = self.children[1];
			follow = self.children[0];
		}

		//------------------------------------------------------------------------------------------------------------------------------------
		// settings & variables

		let settings = extend({
			'startAt'		: 0,
			'image'			: '',	// full path of image
			'height'		: 40,
			'width'			: 100,
			'unit'			: '%',	// 'px' or '%'
			'pill'			: true,
			'snap'			: {
				'marks'		: false,
				'type'		: false,
				'points'	: 0,
				'sensitivity': 2
			},
			'colorShift'	: [],
			'disabled'		: false,
			'vertical'		: false,
			'noHandle'		: false,
			'buttons'		: false,
			'retina'		: false,
			'totalRange'	: [0,0]
		}, options);

		self.removeAttribute('style');	// remove user inline styles

		if (uAgent.match(/Android/i) ||
			uAgent.match(/webOS/i) ||
			uAgent.match(/iPhone/i) ||
			uAgent.match(/iPad/i) ||
			uAgent.match(/iPod/i) ||
			// uAgent.match(/Windows Phone/i) ||
			uAgent.match(/BlackBerry/i)){
			isMobile = true;
			mEvt.down = 'touchstart'; mEvt.up = 'touchend'; mEvt.move = 'touchmove';
			let touchX = null, touchY = null;
		} else if (uAgent.match(/Windows Phone/i)){
			if (window.navigator.msPointerEnabled){
				css(self, {'-ms-touch-action': 'none'});
				mEvt.down = 'MSPointerDown'; mEvt.up = 'MSPointerUp'; mEvt.move = 'MSPointerMove';
			} else {
				mEvt.down = 'touchstart'; mEvt.up = 'touchend'; mEvt.move = 'touchmove';
			}
		}

		// local variables
		THE_VALUE			= settings.startAt;
		
		let result			= 0,
			knob_bg			= '#333',
			knob_width		= (settings.noHandle ? '0' : '2%'),
			self_height		= Math.round(settings.height)+'px',
			knob_height		= 'inherit',
			MSoffsetTop		= null,
			vmarks			= null;

		const vert			= settings.vertical,
			is_snap			= (settings.snap.points > 1 && settings.snap.points <= 11),
			markers			= (is_snap && settings.snap.marks),
			snapType		= (settings.snap.type != 'hard' && settings.snap.type != 'soft') ? false : settings.snap.type,
			r_corners		= settings.pill,
			imageBln		= (settings.image && !settings.noHandle),
			retina			= (window.devicePixelRatio > 1) && settings.retina,
			customRange		= (settings.totalRange[0] !== 0 || settings.totalRange[1] !== 0) && settings.totalRange[0] < settings.totalRange[1];

		colorChangeBln		= (settings.colorShift.length > 1);
		keyCtrl				= (self.getAttribute('data-keys') === 'true');
		keyCtrlCtrl			= (self.getAttribute('data-keys') === 'ctrl');
		keyCtrlShift		= (self.getAttribute('data-keys') === 'shift');
		buttons				= settings.buttons;

		//------------------------------------------------------------------------------------------------------------------------------------
		// image handling

		if (imageBln){	// if image
			path = settings.image;

			// retina handling
			if (retina){
				const ix = path.lastIndexOf('.');
				path = path.slice(0, ix) + '@2x' + path.slice(ix);
			}

			let img = new Image();
			img.onload = imgLoad;
			img.src = path;

			knob.appendChild(img);

			function imgLoad(){
				if (retina)
					img.style.width = (img.offsetWidth / 2) + 'px';
					// img.style.height = (img.offsetHeight / 2) + 'px';

				// determine knob image style requirements
				var thisHeight = img.offsetHeight;
				knob_width = img.offsetWidth+'px';
				knob_height = thisHeight+'px';
				knob_bg = 'url('+path+') no-repeat';

				// apply knob image styles
				knob.style.width = knob_width;
				knob.style.height = knob_height;
				setTimeout(() => {
					knob.style.background = knob_bg;
					if (retina) knob.style.backgroundSize = '100%';
				}, 0);

				// set bar styles
				css(follow, {
					'height': knob_height,
					'border-radius': r_corners ? thisHeight / 2 + 'px 0 0 ' + thisHeight / 2 + 'px' : '0'
				});
				css(self, {
					'height': knob_height,
					'border-radius': r_corners ? thisHeight / 2 + 'px' : '0'
				});

				knob.removeChild(img);

				// bar height less than that of knob
				if (thisHeight > settings.height){
					var knobMarginValue = (thisHeight-settings.height)/2;
					css(self, {
						// 'margin-top': knobMarginValue+'px',
						'height': settings.height+'px'
					});
					css(knob, {
						'top': '-'+knobMarginValue+'px'
					});
					css(follow, {
						'height': settings.height+'px',
						'border-radius': r_corners ? thisHeight / 2 + 'px 0 0 ' + thisHeight / 2 + 'px' : '0'
					});
				} else {
					// children stay inside parent
					css(self, {'overflow': 'hidden'});
				}

				self.dispatchEvent(eventMakeReady);
			}
		} else {
			var d = settings.height / 2;
			css(self, {'border-radius': (r_corners ? d+'px' : '0'), 'overflow': 'hidden'});
			css(follow, {'border-radius': (r_corners ? d+'px 0 0 '+d+'px' : '0')});
			setTimeout(() => {
				knob.style.backgroundColor = knob_bg;	// IE patch
				self.dispatchEvent(eventMakeReady);
			}, 0);
		}

		//------------------------------------------------------------------------------------------------------------------------------------
		// styles

		// validate some user settings
		let unit = settings.unit, width = settings.width;
		if (unit != 'px' && unit != '%') unit = '%';
		else if (unit == 'px') width = Math.round(width);
		else if (unit == '%' && Math.round(width) > 100) width = 100;

		let cssPrefixes		= ['-webkit-', '-khtml-', '-moz-', '-ms-', '-o-', ''],
			cssBorderBox	= {'box-sizing': 'border-box'},
			cssContentBox	= {'box-sizing': 'content-box'},
			cssUserSelect	= {'user-select': 'none'},
			cssRotate		= {'transform': 'rotate(-90deg)'};

		css(self, {
			'width': width + unit,
			'height': self_height,
			'text-align': 'left',
			'margin': 'auto',
			'cursor': (!settings.disabled ? 'pointer' : 'default'),
			'z-index': '997',
			'position': 'relative',
			'-webkit-touch-callout': 'none'
		});
		css(self, clone(cssContentBox), cssPrefixes);
		css(self, clone(cssUserSelect), cssPrefixes);

		css(knob, {
			'width': knob_width,
			'background': knob_bg,
			'height': knob_height,
			'display': 'inline-block',
			'font-size': '0',
			'position': 'relative',
			'z-index': '1'
		});
		css(knob, clone(cssContentBox), cssPrefixes);

		css(follow, {
			'position': 'absolute',
			'height': 'inherit',//knob.offsetHeight+'px',
			'width': '0'
		});
		css(follow, clone(cssContentBox), cssPrefixes);

		//------------------------------------------------------------------------------------------------------------------------------------
		// snap marks, buttons, vertical

		const preSnap = () => {
			doSnap((snapType !== 'soft' ? 'drag' : 'hard'), knob.offsetLeft);
			THE_VALUE = getPercent(knob.offsetLeft);
		};

		// snap to
		const snaps = Math.round(settings.snap.points);
		let marks = null;
		let snapping_on = false;
		let snapPctValues = [0];

		const setSnapValues = () => {
			var kw = knob.offsetWidth;

			// percentage
			var increment = 100 / (snaps - 1);
			var step = increment;
			while (step <= 101){	// added 1% to fix glitch when drawing last mark at 7 or 8 snaps (accounts for decimal)
				snapPctValues.push(step);
				step += increment;
			}

			snapping_on = true;

			if (markers) drawSnapmarks(kw);
		};

		const drawSnapmarks = kw => {
			var selfWidth = self.offsetWidth;
			self.insertAdjacentHTML('afterend', '<div id="'+guid+'_markers" class="sglide-markers"></div>');
			marks = $('#'+guid+'_markers')[0];
			css(marks, {
				'position': 'relative',
				'width': self.offsetWidth+'px', //settings.width + unit,
				'margin': 'auto',
				'-webkit-touch-callout': 'none'
			});
			css(marks, {'box-sizing': 'border-box'}, cssPrefixes);
			css(marks, {'user-select': 'none'}, cssPrefixes);

			if (marks){
				let str = '';
				let val = null;

				css(marks, {'width': selfWidth+'px'});

				// by px
				for (let i = snaps - 1; i >= 0; i--){
					val = (selfWidth - kw) / (snaps-1) * i + (kw/2);
					str += '<div style="width:0; height:5px; border-left:#333 solid 1px; position:absolute; left:'+val+'px"></div>';
				}
				// by %
				/*for (var j = snapPctValues.length - 1; j >= 0; j--){
					val = (selfWidth - kw) * (snapPctValues[j] / 100) + (kw/2);
					str += '<div style="width:0; height:5px; border-left:#333 solid 1px; position:absolute; top:6px; left:'+val+'px"></div>';
				}*/

				marks.innerHTML = str;
			}
		};

		// -----------

		// vertical
		const verticalTransform = () => {
			var vertWidth = Math.round(self.offsetWidth);
			if (markers && is_snap){
				let a = [self, $('#'+guid+'_markers')[0]];

				wrapAll(a, '<div id="'+guid+'_vert-marks" style="margin:0; z-index:997; width:'+width+unit+
					'; -webkit-backface-visibility:hidden; -moz-backface-visibility:hidden; -ms-backface-visibility:hidden; backface-visibility:hidden"></div>');

				vmarks = $('#'+guid+'_vert-marks')[0];

				css(self, {'width': '100%'});
				css(vmarks, clone(cssContentBox), cssPrefixes);
				css(vmarks, clone(cssRotate), cssPrefixes);
				css(vmarks, {'filter': 'progid:DXImageTransform.Microsoft.BasicImage(rotation=3)'});
				css(vmarks, {'transform-origin': vertWidth+'px 0'}, cssPrefixes);

				// for (let item of a){
				// 	css(item, {'margin': '0'});
				// }
			} else {
				// check whether even by even or odd by odd to fix blurred elements
				css(self, {'margin': '0', 'top': '0', 'left': '0'});
				css(self, {'backface-visibility': 'hidden'}, cssPrefixes);
				css(self, clone(cssRotate), cssPrefixes);
				css(self, {'filter': 'progid:DXImageTransform.Microsoft.BasicImage(rotation=3)'});
				css(self, {'transform-origin': vertWidth+'px 0'}, cssPrefixes);
			}
			self.classList.add('vertical');
		};

		// -----------

		let idx = null;	// snapPctValues index

		// buttons
		const drawButtons = () => {
			knob_adjust = knob.offsetWidth / self.offsetWidth * 50;

			var vertStyles	= '; z-index:1000; position:relative; top:30px',
				plusStr		= '<div class="sglide-buttons" id="'+guid+'_plus" style="display:inline-block; cursor:pointer'+(vert ? vertStyles : '')+'">&nbsp;+&nbsp;</div>',
				minusStr	= '<div class="sglide-buttons" id="'+guid+'_minus" style="display:inline-block; cursor:pointer'+(vert ? vertStyles : '')+'">&nbsp;&minus;&nbsp;</div>';

			if (markers){
				let q = null;
				if (!vert){
					css(self, {'width': 'auto'});
					let a = (vert) ? [$('#'+guid+'_vert-marks')[0]] : [$('#'+guid)[0], $('#'+guid+'_markers')[0]];
					wrapAll(a, '<div id="'+guid+'_button-marks" style="display:inline-block; vertical-align:middle; width:'+width+unit+'"></div>');
					q = $('#'+guid+'_button-marks');
				} else {
					q = $('#'+guid+'_vert-marks');
				}

				q[0].insertAdjacentHTML('afterend', plusStr);
				q[0].insertAdjacentHTML('beforebegin', minusStr);
			} else {
				css(self, {
					'display': (!vert) ? 'inline-block' : 'block',
					'vertical-align': 'middle'
				});

				self.insertAdjacentHTML('afterend', plusStr);
				self.insertAdjacentHTML('beforebegin', minusStr);
			}

			var plusBtn		= $('#'+guid+'_plus')[0],
				minusBtn	= $('#'+guid+'_minus')[0];

			css(minusBtn, clone(cssUserSelect), cssPrefixes);
			css(plusBtn, clone(cssUserSelect), cssPrefixes);

			if (!settings.disabled){
				plusBtn.addEventListener(mEvt.down, eventPlusMouseDown);
				plusBtn.addEventListener(mEvt.up, btnClearAction);

				minusBtn.addEventListener(mEvt.down, eventMinusMouseDown);
				minusBtn.addEventListener(mEvt.up, btnClearAction);
			}
		};

		const btnTriggers = (direction, smoothBln) => {
			// var set_value = THE_VALUE = valueObj[guid];
			if (btn_snap){
				if (idx === null){
					for (let i = 0; i < snapPctValues.length; i++){
						if (snapPctValues[i] >= THE_VALUE){
							if (direction === '>') idx = i-1;
							else idx = i;
							break;
						}
					}
				}

				if (direction === '>'){
					if (snaps-1 > idx) idx++;
				} else {
					if (idx > 0) idx--;
				}
				THE_VALUE = snapPctValues[idx];
			} else {
				if (direction === '>')	THE_VALUE += (smoothBln ? 1 : 10);
				else					THE_VALUE -= (smoothBln ? 1 : 10);
			}

			set_value = THE_VALUE;	// leave THE_VALUE out of visual adjustments

			// constraints
			if ((THE_VALUE+knob_adjust) > 100)	{ THE_VALUE = 100; set_value = 100; }
			else if (THE_VALUE-knob_adjust < 0)	{ THE_VALUE = 0; set_value = 0; }

			// set pixel positions
			var px = (self.offsetWidth - knob.offsetWidth) * set_value / 100 + (knob.offsetWidth / 2);
			var pxAdjust = px - knob.offsetWidth / 2;

			// gui
			knob.style.left = pxAdjust+'px';// (set_value-knob_adjust)+'%';
			follow.style.width = px+'px';// set_value+'%';
			if (colorChangeBln) colorChange(set_value);

			// output
			THE_VALUE = getPercent(pxAdjust);
			if (options.onButton) options.onButton.call(that, updateME(THE_VALUE));
		};

		const btnHold = dir => {
			var btnHold_timer = setInterval(() => {
				if (btn_is_down) btnTriggers(dir, true);
				else clearInterval(btnHold_timer);
			}, (btn_snap ? 101 : 10));
		};

		const btnClearAction = () => {
			btn_is_down = false;
			clearTimeout(btn_timers);
		};

		var knob_adjust = 0, btn_is_down = false, btn_timers = null;
		var btn_snap = (is_snap && (snapType === 'hard' || snapType === 'soft'));

		// button and arrow key events
		eventPlusMinusMouseUp	= btnClearAction;
		eventPlusMouseDown		= () => eventPlusMinusMouseDown('>');
		eventMinusMouseDown		= () => eventPlusMinusMouseDown('<');
		const eventPlusMinusMouseDown = dir => {
			btn_is_down = true;
			btnTriggers(dir);
			btn_timers = setTimeout(() => btnHold(dir), 500);
		};

		//------------------------------------------------------------------------------------------------------------------------------------
		// events

		// knob
		let is_down = false;

		// snapping
		let storedSnapValue = 's-1';

		const doSnap = (kind, m) => {
			if (is_snap){	// min 1, max 9
				var sense = settings.snap.sensitivity;

				// although snap is enabled, sensitivity may be set to nill, in which case marks are drawn but won't snap to
				if (sense || snapType === 'hard' || snapType === 'soft'){
					var knobWidth	= knob.offsetWidth,
						selfWidth	= self.offsetWidth,
						snapOffset	= (sense && sense > 0 && sense < 4 ? (sense + 1) * 5 : 15) - 3;

					// % to px
					let snapPixelValues = [];
					// for (var j = 0; j < snapPctValues.length; j++){
					for (let pct of snapPctValues){
						snapPixelValues.push((selfWidth - knobWidth) * pct / 100);
					}

					// get closest px mark, and set %
					let closest = null, pctVal = 0, i = 0;
					// for (let i = 0; i < snapPixelValues.length; i++){
					for (let pxl of snapPixelValues){
						if (closest === null || Math.abs(pxl - m) < Math.abs(closest - m)){
							closest = pxl;
							pctVal = snapPctValues[i];
							idx = i;
						}
						i++;
					}

					// physically snap it
					if (kind === 'drag'){
						if (snapType === 'hard'){
							knob.style.left = closest+'px';
							follow.style.width = closest+knobWidth/2+'px';
							doOnSnap(closest, pctVal);
						} else {
							if (Math.round(Math.abs(closest - m)) < snapOffset){
								knob.style.left = closest+'px';
								follow.style.width = closest+knobWidth/2+'px';
								doOnSnap(closest, pctVal);
							} else storedSnapValue = 's-1';
						}
					} else {
						knob.style.left = closest+'px';
						follow.style.width = closest+knobWidth/2+'px';
						return closest;
					}
				}
			}
		};

		const doOnSnap = (a, b) => { // callback: onSnap
			if (options.onSnap && 's'+a !== storedSnapValue){
				storedSnapValue = 's'+a;
				THE_VALUE = getPercent(a);
				if (options.onSnap) options.onSnap.call(that, updateME(THE_VALUE));
			}
		};

		// keyboard controls
		// if keyboard control enabled or shift additionally required
		if (!isMobile && (keyCtrl || keyCtrlShift || keyCtrlCtrl) && !settings.disabled){
			let keycode, keydown = false, shifted = false, ctrled = false,
				codeBack	= vert ? 40 : 37,
				codeFwd		= vert ? 38 : 39;

			eventDocumentKeyDown = e => {
				if (!keydown){
					if (window.event){
						keycode = window.event.keyCode;
						shifted = window.event.shiftKey;
						ctrled	= window.event.ctrlKey;
					} else if (e){
						keycode = e.which;
						shifted = e.shiftKey;
						ctrled	= e.ctrlKey;
					}

					// if shift required, then shift must be pressed
					if (keyCtrlShift && shifted && !ctrled || keyCtrlCtrl && ctrled && !shifted || !keyCtrlShift && !keyCtrlCtrl){
						if (keycode === codeBack){
							eventMinusMouseDown();
							keydown = true;
						} else if (keycode === codeFwd){
							eventPlusMouseDown();
							keydown = true;
						}
					}
				}
			};
			eventDocumentKeyUp = () => {
				keydown = false;
				btnClearAction();
			};

			document.addEventListener('keydown', eventDocumentKeyDown);
			document.addEventListener('keyup', eventDocumentKeyUp);
		}

		if (isMobile){
			eventDocumentMouseDown = e => {
				touchX = e.targetTouches[0].pageX;
				touchY = e.targetTouches[0].pageY;
			};
			document.addEventListener(mEvt.down, eventDocumentMouseDown);
		}

		eventDocumentMouseMove = e => {
			if (is_down){
				e = e || event;	// ie fix

				const selfWidth	= self.offsetWidth;
				const knobWidth	= knob.offsetWidth;
				var x			= null;

				if (vert){
					// MS bug: manually set offsetTop, otherwise try to get the vertical wrapper's offsetTop
					if (window.navigator.msPointerEnabled && MSoffsetTop === null) MSoffsetTop = self.getBoundingClientRect().top;
					else if (vmarks !== null && MSoffsetTop === null) MSoffsetTop = vmarks.offsetTop;

					let base = (MSoffsetTop !== null ? MSoffsetTop : self.offsetTop) + selfWidth;
					if (isMobile){
						touchY = e.targetTouches[0].pageY;
						x = base - touchY;
					} else x = base - e.pageY;
				} else {
					if (isMobile){
						touchX = e.targetTouches[0].pageX;
						x = touchX - self.offsetLeft;
					} else x = e.pageX - self.offsetLeft;
				}

				const stopper	= knobWidth / 2,
					m		= x - stopper;

				if (e.returnValue) e.returnValue = false;

				// constraint
				if (x <= stopper && (!is_snap || snapType !== 'hard')){
					knob.style.left = '0';
					follow.style.width = stopper+'px';
				} else if (x >= selfWidth-stopper && (!is_snap || snapType !== 'hard')){
					knob.style.left = (selfWidth-knobWidth)+'px';
					follow.style.width = (selfWidth-stopper)+'px';
				} else {
					knob.style.left = (x-stopper)+'px';
					follow.style.width = x+'px';
					// if (!settings.snap.onlyOnDrop) doSnap('drag', m);
					if (!snapType || snapType === 'hard') doSnap('drag', m);
				}

				result = knob.offsetLeft; // was knob.style.left;
				// result = result.replace('px', '');

				var state = self.getAttribute('data-state');

				THE_VALUE = getPercent(result);

				// update values
				if (options.drag && state === 'active')
					options.drag.call(that, updateME(THE_VALUE));

				// color change
				if (colorChangeBln && state === 'active')
					colorChange(THE_VALUE);
			}
		};

		eventDocumentMouseUp = e => {
			is_down = false;
			if (self.getAttribute('data-state') === 'active'){
				e = e || event;	// ie fix

				const m = knob.offsetLeft;

				// snap to
				if (is_snap && (snapType === 'soft' || snapType === 'hard'))	// min 1, max 9
					result = doSnap('drop', m);
				else
					result = (m < 0 ? 0 : m);

				THE_VALUE = getPercent(result);

				if (options.drop) options.drop.call(that, updateME(THE_VALUE));
				if (options.drag) options.drag.call(that, updateME(THE_VALUE));
				self.setAttribute('data-state', 'inactive');

				// color change
				if (colorChangeBln) colorChange(THE_VALUE);
			}

			// if button pressed but released off button, clear button action
			if (btn_is_down) btnClearAction();
		};

		eventWindowResize = () => {
			const kw	= knob.offsetWidth;
			const selfWidth = self.offsetWidth;
			that.startAt(THE_VALUE);

			if (marks){
				let val = null;
				marks.style.width = selfWidth+'px';
				let divArray = Array.prototype.slice.call(marks.children);
				for (let i = divArray.length - 1; i >= 0; i--){
					val = (selfWidth - kw) / (snaps-1) * i + (kw/2);
					divArray[i].style.left = val+'px';
				}
			}
		};

		document.addEventListener(mEvt.move, eventDocumentMouseMove);
		document.addEventListener(mEvt.up, eventDocumentMouseUp);
		window.addEventListener('resize', eventWindowResize);

		//------------------------------------------------------------------------------------------------------------------------------------
		// functions

		if (customRange){
			var cstmStart = settings.totalRange[0];
			var diff = settings.totalRange[1] - cstmStart;
		}

		const getPercent = num => {
			var pct = num / (self.offsetWidth - knob.offsetWidth) * 100;
			pct = Math.min(pct, 100);

			return pct;
		};

		const updateME = pct => {
			// set data to send
			var sendData = {
				'percent': pct,
				'id': guid,
				'el': self
			};

			// calculate unit
			if (customRange){
				let cstm = diff * pct / 100 + cstmStart;
				sendData.custom = cstm;
			}

			return sendData;
		};

		// color change
		const colorShiftInit = () => {
			// const selfHeightHalf = self.offsetHeight / 2;
			// var borderRadius = 'border-radius: '+(r_corners ? selfHeightHalf + 'px 0 0 ' + selfHeightHalf + 'px' : '0');
			css(follow, {
				'overflow': 'hidden',
				'background-color': settings.colorShift[0]
			});

			follow.innerHTML = '<div style="opacity:'+(settings.startAt/100)+'; height:100%; background-color:'+settings.colorShift[1]+'; "></div>';
		};

		const colorChange = pct => follow.children[0].style.opacity = pct / 100;

		const eventBarMouseDown = e => {
			e = e || event;	// ie fix
			if (e.returnValue) e.returnValue = false;	// wp

			is_down = true;
			self.setAttribute('data-state', 'active');

			if (!isMobile){// && snapType !== 'hard'){
				const selfWidth = self.offsetWidth;
				const knobWidth = knob.offsetWidth;
				let x = null;


				if (vert){
					// MS bug: manually set offsetTop, otherwise try to get the vertical wrapper's offsetTop
					if (window.navigator.msPointerEnabled && MSoffsetTop === null) MSoffsetTop = self.getBoundingClientRect().top;
					else if (vmarks !== null && MSoffsetTop === null) MSoffsetTop = vmarks.offsetTop;

					const base = (MSoffsetTop !== null ? MSoffsetTop : self.offsetTop) + selfWidth;
					// var base = self.offsetTop + selfWidth;
					x = base - (e.pageY-2);
				} else x = e.pageX - self.offsetLeft;
				const m = x - (knobWidth / 2);	// true position of knob
				
				// constraint
				if (m < 0){
					m = 0;
					knob.style.left = '0';
				} else if (m >= selfWidth-knobWidth){
					m = selfWidth-knobWidth;
					knob.style.left = (selfWidth-knobWidth)+'px';
				}

				knob.style.left = m+'px';
				follow.style.width = m+(knobWidth/2)+'px';

				if (!snapType || snapType === 'hard') doSnap('drag', m);

				// color change
				if (colorChangeBln) colorChange(getPercent(m));
			}
		};

		if (!settings.disabled)
			self.addEventListener(mEvt.down, eventBarMouseDown);

		//------------------------------------------------------------------------------------------------------------------------------------
		// start

		const setStartAt = e => {
			const num = THE_VALUE;
			var rlt = updateME(num);

			if (customRange) rlt.custom = diff * num / 100 + cstmStart;

			// inits
			if (is_snap)					setSnapValues();
			if (vert)						verticalTransform();
			if (buttons)					drawButtons();
			if (colorChangeBln)				colorShiftInit();
			// if (options.onload)				options.onload(rlt);

			that.startAt(num);

			// pre snap
			if (snapType === 'hard' || snapType === 'soft') {
				preSnap();
				rlt = updateME(THE_VALUE);
			}

			self.removeEventListener('makeready.'+guid, setStartAt);

			const ready = new CustomEvent('sGlide.ready', {'detail': rlt});
			self.dispatchEvent(ready);
			self.removeEventListener('sGlide.ready', null);
		};

		// Listen for image loaded
		const eventMakeReady = new Event('makeready.'+guid);
		self.addEventListener('makeready.'+guid, setStartAt);
	};
}