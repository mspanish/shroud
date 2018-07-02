(function () {
'use strict';

function noop() {}

function assign(tar, src) {
	for (var k in src) tar[k] = src[k];
	return tar;
}

function assignTrue(tar, src) {
	for (var k in src) tar[k] = 1;
	return tar;
}

function addLoc(element, file, line, column, char) {
	element.__svelte_meta = {
		loc: { file, line, column, char }
	};
}

function appendNode(node, target) {
	target.appendChild(node);
}

function insertNode(node, target, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function detachBefore(after) {
	while (after.previousSibling) {
		after.parentNode.removeChild(after.previousSibling);
	}
}

function reinsertChildren(parent, target) {
	while (parent.firstChild) target.appendChild(parent.firstChild);
}

function destroyEach(iterations, detach) {
	for (var i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detach);
	}
}

function createFragment() {
	return document.createDocumentFragment();
}

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function createComment() {
	return document.createComment('');
}

function addListener(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function setAttribute(node, attribute, value) {
	node.setAttribute(attribute, value);
}

function setStyle(node, key, value) {
	node.style.setProperty(key, value);
}

function linear(t) {
	return t;
}

function generateRule({ a, b, delta, duration }, ease, fn) {
	const step = 16.666 / duration;
	let keyframes = '{\n';

	for (let p = 0; p <= 1; p += step) {
		const t = a + delta * ease(p);
		keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
	}

	return keyframes + `100% {${fn(b, 1 - b)}}\n}`;
}

// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return hash >>> 0;
}

function wrapTransition(component, node, fn, params, intro) {
	let obj = fn(node, params);
	let duration;
	let ease;
	let cssText;

	let initialised = false;

	return {
		t: intro ? 0 : 1,
		running: false,
		program: null,
		pending: null,

		run(b, callback) {
			if (typeof obj === 'function') {
				transitionManager.wait().then(() => {
					obj = obj();
					this._run(b, callback);
				});
			} else {
				this._run(b, callback);
			}
		},

		_run(b, callback) {
			duration = obj.duration || 300;
			ease = obj.easing || linear;

			const program = {
				start: window.performance.now() + (obj.delay || 0),
				b,
				callback: callback || noop
			};

			if (intro && !initialised) {
				if (obj.css && obj.delay) {
					cssText = node.style.cssText;
					node.style.cssText += obj.css(0, 1);
				}

				if (obj.tick) obj.tick(0, 1);
				initialised = true;
			}

			if (!b) {
				program.group = transitionManager.outros;
				transitionManager.outros.remaining += 1;
			}

			if (obj.delay) {
				this.pending = program;
			} else {
				this.start(program);
			}

			if (!this.running) {
				this.running = true;
				transitionManager.add(this);
			}
		},

		start(program) {
			component.fire(`${program.b ? 'intro' : 'outro'}.start`, { node });

			program.a = this.t;
			program.delta = program.b - program.a;
			program.duration = duration * Math.abs(program.b - program.a);
			program.end = program.start + program.duration;

			if (obj.css) {
				if (obj.delay) node.style.cssText = cssText;

				const rule = generateRule(program, ease, obj.css);
				transitionManager.addRule(rule, program.name = '__svelte_' + hash(rule));

				node.style.animation = (node.style.animation || '')
					.split(', ')
					.filter(anim => anim && (program.delta < 0 || !/__svelte/.test(anim)))
					.concat(`${program.name} ${program.duration}ms linear 1 forwards`)
					.join(', ');
			}

			this.program = program;
			this.pending = null;
		},

		update(now) {
			const program = this.program;
			if (!program) return;

			const p = now - program.start;
			this.t = program.a + program.delta * ease(p / program.duration);
			if (obj.tick) obj.tick(this.t, 1 - this.t);
		},

		done() {
			const program = this.program;
			this.t = program.b;

			if (obj.tick) obj.tick(this.t, 1 - this.t);

			component.fire(`${program.b ? 'intro' : 'outro'}.end`, { node });

			if (!program.b && !program.invalidated) {
				program.group.callbacks.push(() => {
					program.callback();
					if (obj.css) transitionManager.deleteRule(node, program.name);
				});

				if (--program.group.remaining === 0) {
					program.group.callbacks.forEach(fn => {
						fn();
					});
				}
			} else {
				if (obj.css) transitionManager.deleteRule(node, program.name);
			}

			this.running = !!this.pending;
		},

		abort() {
			if (this.program) {
				if (obj.tick) obj.tick(1, 0);
				if (obj.css) transitionManager.deleteRule(node, this.program.name);
				this.program = this.pending = null;
				this.running = false;
			}
		},

		invalidate() {
			if (this.program) {
				this.program.invalidated = true;
			}
		}
	};
}

var transitionManager = {
	running: false,
	transitions: [],
	bound: null,
	stylesheet: null,
	activeRules: {},
	promise: null,

	add(transition) {
		this.transitions.push(transition);

		if (!this.running) {
			this.running = true;
			requestAnimationFrame(this.bound || (this.bound = this.next.bind(this)));
		}
	},

	addRule(rule, name) {
		if (!this.stylesheet) {
			const style = createElement('style');
			document.head.appendChild(style);
			transitionManager.stylesheet = style.sheet;
		}

		if (!this.activeRules[name]) {
			this.activeRules[name] = true;
			this.stylesheet.insertRule(`@keyframes ${name} ${rule}`, this.stylesheet.cssRules.length);
		}
	},

	next() {
		this.running = false;

		const now = window.performance.now();
		let i = this.transitions.length;

		while (i--) {
			const transition = this.transitions[i];

			if (transition.program && now >= transition.program.end) {
				transition.done();
			}

			if (transition.pending && now >= transition.pending.start) {
				transition.start(transition.pending);
			}

			if (transition.running) {
				transition.update(now);
				this.running = true;
			} else if (!transition.pending) {
				this.transitions.splice(i, 1);
			}
		}

		if (this.running) {
			requestAnimationFrame(this.bound);
		} else if (this.stylesheet) {
			let i = this.stylesheet.cssRules.length;
			while (i--) this.stylesheet.deleteRule(i);
			this.activeRules = {};
		}
	},

	deleteRule(node, name) {
		node.style.animation = node.style.animation
			.split(', ')
			.filter(anim => anim && anim.indexOf(name) === -1)
			.join(', ');
	},

	groupOutros() {
		this.outros = {
			remaining: 0,
			callbacks: []
		};
	},

	wait() {
		if (!transitionManager.promise) {
			transitionManager.promise = Promise.resolve();
			transitionManager.promise.then(() => {
				transitionManager.promise = null;
			});
		}

		return transitionManager.promise;
	}
};

function blankObject() {
	return Object.create(null);
}

function destroy(detach) {
	this.destroy = noop;
	this.fire('destroy');
	this.set = noop;

	this._fragment.d(detach !== false);
	this._fragment = null;
	this._state = {};
}

function destroyDev(detach) {
	destroy.call(this, detach);
	this.destroy = function() {
		console.warn('Component was already destroyed');
	};
}

function _differs(a, b) {
	return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function _differsImmutable(a, b) {
	return a != a ? b == b : a !== b;
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		var handler = handlers[i];

		if (!handler.__calling) {
			handler.__calling = true;
			handler.call(this, data);
			handler.__calling = false;
		}
	}
}

function get() {
	return this._state;
}

function init(component, options) {
	component._handlers = blankObject();
	component._bind = options._bind;

	component.options = options;
	component.root = options.root || component;
	component.store = options.store || component.root.store;
}

function on(eventName, handler) {
	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set(newState) {
	this._set(assign({}, newState));
	if (this.root._lock) return;
	this.root._lock = true;
	callAll(this.root._beforecreate);
	callAll(this.root._oncreate);
	callAll(this.root._aftercreate);
	this.root._lock = false;
}

function _set(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign(assign({}, oldState), newState);
	this._recompute(changed, this._state);
	if (this._bind) this._bind(changed, this._state);

	if (this._fragment) {
		this.fire("state", { changed: changed, current: this._state, previous: oldState });
		this._fragment.p(changed, this._state);
		this.fire("update", { changed: changed, current: this._state, previous: oldState });
	}
}

function setDev(newState) {
	if (typeof newState !== 'object') {
		throw new Error(
			this._debugName + '.set was called without an object of data key-values to update.'
		);
	}

	this._checkReadOnly(newState);
	set.call(this, newState);
}

function callAll(fns) {
	while (fns && fns.length) fns.shift()();
}

function _mount(target, anchor) {
	this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
}

function removeFromStore() {
	this.store._remove(this);
}

var protoDev = {
	destroy: destroyDev,
	get,
	fire,
	on,
	set: setDev,
	_recompute: noop,
	_set,
	_mount,
	_differs
};

var a = typeof document !== 'undefined' && document.createElement( 'a' );
var QUERYPAIR_REGEX = /^([\w\-]+)(?:=([^&]*))?$/;
var HANDLERS = [ 'beforeenter', 'enter', 'leave', 'update' ];

var isInitial = true;

function RouteData (ref) {
	var route = ref.route;
	var pathname = ref.pathname;
	var params = ref.params;
	var query = ref.query;
	var hash = ref.hash;
	var scrollX = ref.scrollX;
	var scrollY = ref.scrollY;

	this.pathname = pathname;
	this.params = params;
	this.query = query;
	this.hash = hash;
	this.isInitial = isInitial;
	this.scrollX = scrollX;
	this.scrollY = scrollY;

	this._route = route;

	isInitial = false;
}

RouteData.prototype = {
	matches: function matches ( href ) {
		return this._route.matches( href );
	}
};

function Route ( path, options ) {
	var this$1 = this;

	// strip leading slash
	if ( path[0] === '/' ) {
		path = path.slice( 1 );
	}

	this.path = path;
	this.segments = path.split( '/' );

	if ( typeof options === 'function' ) {
		options = {
			enter: options
		};
	}

	this.updateable = typeof options.update === 'function';

	HANDLERS.forEach( function (handler) {
		this$1[ handler ] = function ( route, other ) {
			var value;

			if ( options[ handler ] ) {
				value = options[ handler ]( route, other );
			}

			return roadtrip.Promise.resolve( value );
		};
	});
}

Route.prototype = {
	matches: function matches$1 ( href ) {
		a.href = href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ? 
			a.pathname.slice( 1 ) :
			a.pathname;
		var segments = pathname.split( '/' );

		return segmentsMatch( segments, this.segments );
	},

	exec: function exec ( target ) {
		var this$1 = this;

		a.href = target.href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ? 
			a.pathname.slice( 1 ) :
			a.pathname;
		var search = a.search.slice( 1 );

		var segments = pathname.split( '/' );

		if ( segments.length !== this.segments.length ) {
			return false;
		}

		var params = {};

		for ( var i = 0; i < segments.length; i += 1 ) {
			var segment = segments[i];
			var toMatch = this$1.segments[i];

			if ( toMatch[0] === ':' ) {
				params[ toMatch.slice( 1 ) ] = segment;
			}

			else if ( segment !== toMatch ) {
				return false;
			}
		}

		var query = {};
		var queryPairs = search.split( '&' );

		for ( var i$1 = 0; i$1 < queryPairs.length; i$1 += 1 ) {
			var match = QUERYPAIR_REGEX.exec( queryPairs[i$1] );

			if ( match ) {
				var key = match[1];
				var value = decodeURIComponent( match[2] );

				if ( query.hasOwnProperty( key ) ) {
					if ( typeof query[ key ] !== 'object' ) {
						query[ key ] = [ query[ key ] ];
					}

					query[ key ].push( value );
				}

				else {
					query[ key ] = value;
				}
			}
		}

		return new RouteData({
			route: this,
			pathname: pathname,
			params: params,
			query: query,
			hash: a.hash.slice( 1 ),
			scrollX: target.scrollX,
			scrollY: target.scrollY
		});
	}
};

function segmentsMatch ( a, b ) {
	if ( a.length !== b.length ) { return; }

	var i = a.length;
	while ( i-- ) {
		if ( ( a[i] !== b[i] ) && ( b[i][0] !== ':' ) ) {
			return false;
		}
	}

	return true;
}

var window$1 = ( typeof window !== 'undefined' ? window : null );

var routes = [];

// Adapted from https://github.com/visionmedia/page.js
// MIT license https://github.com/visionmedia/page.js#license

function watchLinks ( callback ) {
	window$1.addEventListener( 'click', handler, false );
	window$1.addEventListener( 'touchstart', handler, false );

	function handler ( event ) {
		if ( which( event ) !== 1 ) { return; }
		if ( event.metaKey || event.ctrlKey || event.shiftKey ) { return; }
		if ( event.defaultPrevented ) { return; }

		// ensure target is a link
		var el = event.target;

		// el.nodeName for svg links are 'a' instead of 'A'
		while ( el && el.nodeName.toUpperCase() !== 'A' ) {
			el = el.parentNode;
		}

		if ( !el || el.nodeName.toUpperCase() !== 'A' ) { return; }

		// check if link is inside an svg
		// in this case, both href and target are always inside an object
		var svg = ( typeof el.href === 'object' ) && el.href.constructor.name === 'SVGAnimatedString';

		// Ignore if tag has
		// 1. 'download' attribute
		// 2. rel='external' attribute
		if ( el.hasAttribute( 'download' ) || el.getAttribute( 'rel' ) === 'external' ) { return; }

		// ensure non-hash for the same path

		// Check for mailto: in the href
		if ( ~el.href.indexOf( 'mailto:' ) ) { return; }

		// check target
		// svg target is an object and its desired value is in .baseVal property
		if ( svg ? el.target.baseVal : el.target ) { return; }

		// x-origin
		// note: svg links that are not relative don't call click events (and skip watchLinks)
		// consequently, all svg links tested inside watchLinks are relative and in the same origin
		if ( !svg && !sameOrigin( el.href ) ) { return; }

		// rebuild path
		// There aren't .pathname and .search properties in svg links, so we use href
		// Also, svg href is an object and its desired value is in .baseVal property
		var path = svg ? el.href.baseVal : ( el.pathname + el.search + ( el.hash || '' ) );

		// strip leading '/[drive letter]:' on NW.js on Windows
		if ( typeof process !== 'undefined' && path.match( /^\/[a-zA-Z]:\// ) ) {
			path = path.replace( /^\/[a-zA-Z]:\//, '/' );
		}

		// same page
		var orig = path;

		if ( path.indexOf( roadtrip.base ) === 0 ) {
			path = path.substr( roadtrip.base.length );
		}

		if ( roadtrip.base && orig === path ) { return; }

		// no match? allow navigation
		if ( !routes.some( function (route) { return route.matches( orig ); } ) ) { return; }

		event.preventDefault();
		callback( orig );
	}
}

function which ( event ) {
	event = event || window$1.event;
	return event.which === null ? event.button : event.which;
}

function sameOrigin ( href ) {
	var origin = location.protocol + '//' + location.hostname;
	if ( location.port ) { origin += ':' + location.port; }

	return ( href && ( href.indexOf( origin ) === 0 ) );
}

function isSameRoute ( routeA, routeB, dataA, dataB ) {
	if ( routeA !== routeB ) {
		return false;
	}

	return (
		dataA.hash === dataB.hash &&
		deepEqual( dataA.params, dataB.params ) &&
		deepEqual( dataA.query, dataB.query )
	);
}

function deepEqual ( a, b ) {
	if ( a === null && b === null ) {
		return true;
	}

	if ( isArray( a ) && isArray( b ) ) {
		var i = a.length;

		if ( b.length !== i ) { return false; }

		while ( i-- ) {
			if ( !deepEqual( a[i], b[i] ) ) {
				return false;
			}
		}

		return true;
	}

	else if ( typeof a === 'object' && typeof b === 'object' ) {
		var aKeys = Object.keys( a );
		var bKeys = Object.keys( b );

		var i$1 = aKeys.length;

		if ( bKeys.length !== i$1 ) { return false; }

		while ( i$1-- ) {
			var key = aKeys[i$1];

			if ( !b.hasOwnProperty( key ) || !deepEqual( b[ key ], a[ key ] ) ) {
				return false;
			}
		}

		return true;
	}

	return a === b;
}

var toString = Object.prototype.toString;

function isArray ( thing ) {
	return toString.call( thing ) === '[object Array]';
}

// Enables HTML5-History-API polyfill: https://github.com/devote/HTML5-History-API
var location$1 = window$1 && ( window$1.history.location || window$1.location );

function noop$1 () {}

var currentData = {};
var currentRoute = {
	enter: function () { return roadtrip.Promise.resolve(); },
	leave: function () { return roadtrip.Promise.resolve(); }
};

var _target;
var isTransitioning = false;

var scrollHistory = {};
var uniqueID = 1;
var currentID = uniqueID;

var roadtrip = {
	base: '',
	Promise: Promise,

	add: function add ( path, options ) {
		routes.push( new Route( path, options ) );
		return roadtrip;
	},

	start: function start ( options ) {
		if ( options === void 0 ) options = {};

		var href = routes.some( function (route) { return route.matches( location$1.href ); } ) ?
			location$1.href :
			options.fallback;

		return roadtrip.goto( href, {
			replaceState: true,
			scrollX: window$1.scrollX,
			scrollY: window$1.scrollY
		});
	},

	goto: function goto ( href, options ) {
		if ( options === void 0 ) options = {};

		scrollHistory[ currentID ] = {
			x: window$1.scrollX,
			y: window$1.scrollY
		};

		var target;
		var promise = new roadtrip.Promise( function ( fulfil, reject ) {
			target = _target = {
				href: href,
				scrollX: options.scrollX || 0,
				scrollY: options.scrollY || 0,
				options: options,
				fulfil: fulfil,
				reject: reject
			};
		});

		_target.promise = promise;

		if ( isTransitioning ) {
			return promise;
		}

		_goto( target );
		return promise;
	}
};

if ( window$1 ) {
	watchLinks( function (href) { return roadtrip.goto( href ); } );

	// watch history
	window$1.addEventListener( 'popstate', function (event) {
		if ( !event.state ) { return; } // hashchange, or otherwise outside roadtrip's control
		var scroll = scrollHistory[ event.state.uid ];

		_target = {
			href: location$1.href,
			scrollX: scroll.x,
			scrollY: scroll.y,
			popstate: true, // so we know not to manipulate the history
			fulfil: noop$1,
			reject: noop$1
		};

		_goto( _target );
		currentID = event.state.uid;
	}, false );
}

function _goto ( target ) {
	var newRoute;
	var newData;

	for ( var i = 0; i < routes.length; i += 1 ) {
		var route = routes[i];
		newData = route.exec( target );

		if ( newData ) {
			newRoute = route;
			break;
		}
	}

	if ( !newRoute || isSameRoute( newRoute, currentRoute, newData, currentData ) ) {
		target.fulfil();
		return;
	}

	scrollHistory[ currentID ] = {
		x: ( currentData.scrollX = window$1.scrollX ),
		y: ( currentData.scrollY = window$1.scrollY )
	};

	isTransitioning = true;

	var promise;

	if ( ( newRoute === currentRoute ) && newRoute.updateable ) {
		promise = newRoute.update( newData );
	} else {
		promise = roadtrip.Promise.all([
			currentRoute.leave( currentData, newData ),
			newRoute.beforeenter( newData, currentData )
		]).then( function () { return newRoute.enter( newData, currentData ); } );
	}

	promise
		.then( function () {
			currentRoute = newRoute;
			currentData = newData;

			isTransitioning = false;

			// if the user navigated while the transition was taking
			// place, we need to do it all again
			if ( _target !== target ) {
				_goto( _target );
				_target.promise.then( target.fulfil, target.reject );
			} else {
				target.fulfil();
			}
		})
		.catch( target.reject );

	if ( target.popstate ) { return; }

	var ref = target.options;
	var replaceState = ref.replaceState;
	var invisible = ref.invisible;
	if ( invisible ) { return; }

	var uid = replaceState ? currentID : ++uniqueID;
	history[ replaceState ? 'replaceState' : 'pushState' ]( { uid: uid }, '', target.href );

	currentID = uid;
	scrollHistory[ currentID ] = {
		x: target.scrollX,
		y: target.scrollY
	};
}

/* src\components\Link.html generated by Svelte v2.8.0 */

function data() {
  return {
    cssClass: ''
  }
}
var methods = {
  handleHref(path, e) {
    e.preventDefault();
    roadtrip.goto(path);
  }
};

const file = "src\\components\\Link.html";

function create_main_fragment(component, ctx) {
	var a, slot_content_default = component._slotted.default, a_class_value;

	function click_handler(event) {
		component.handleHref(ctx.href, event);
	}

	return {
		c: function create() {
			a = createElement("a");
			addListener(a, "click", click_handler);
			a.href = ctx.href;
			a.className = a_class_value = "LinkComp " + (ctx.cssClass || '');
			addLoc(a, file, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(a, target, anchor);

			if (slot_content_default) {
				appendNode(slot_content_default, a);
			}
		},

		p: function update(changed, _ctx) {
			ctx = _ctx;
			if (changed.href) {
				a.href = ctx.href;
			}

			if ((changed.cssClass) && a_class_value !== (a_class_value = "LinkComp " + (ctx.cssClass || ''))) {
				a.className = a_class_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(a);
			}

			if (slot_content_default) {
				reinsertChildren(a, slot_content_default);
			}

			removeListener(a, "click", click_handler);
		}
	};
}

function Link(options) {
	this._debugName = '<Link>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data(), options.data);
	if (!('href' in this._state)) console.warn("<Link> was created without expected data property 'href'");
	if (!('cssClass' in this._state)) console.warn("<Link> was created without expected data property 'cssClass'");
	this._intro = true;

	this._slotted = options.slots || {};

	this.slots = {};

	this._fragment = create_main_fragment(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Link.prototype, protoDev);
assign(Link.prototype, methods);

Link.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

/* src\components\Menu.html generated by Svelte v2.8.0 */

const catsData = {
	"event": {
			"menu": "Our Events",
			"desc": "",
			"img": ""
		},
		"speakers": {
			"menu": "Speaker Bios",
			"desc": "",
			"img": ""
		},		
	"faq": {
			"menu": "Why the Shroud?",
			"desc": "",
			"img": ""
		},
		"videos": {
			"menu": "Shroud Videos",
			"desc": "",
			"img": ""
		},
		"articles": {
			"menu": "Shroud Articles",
			"desc": "",
			"img": ""
		},
		"about": {
			"menu": "About Us",
			"desc": "",
			"img": ""
		},
		"donate": {
			"menu": "Donate",
			"desc": "",
			"img": ""
		}					
};

// let cats = [];
//   for (let cat in catsData) {
//   cats.push({id: cat, ...catsData[cat]});
// }
// you don't need to do map AND entries - just 1 will do!! Just use [0] for the key, [1] for the value
 let cats = Object.entries(catsData);

//console.log('cats are now '+JSON.stringify(cats))
 //each Object.entries(obj) and each [...iterable].

  function data$1() {
	return { 
		snippets: [],
		sectionColors: [],
		cats: cats,
	 }
	}
var methods$1 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

function oncreate() {

			/* get the colors for each menu item to use in their section */
			let sections = document.querySelectorAll('nav > ul > li > a');
			let sectionColors = {};
			for (let element of sections) {
				const id = element.parentNode.getAttribute('data-id');
				const color1 = window.getComputedStyle(element).borderLeftColor;
				const color2 = window.getComputedStyle(element,':after').backgroundColor;
				sectionColors[id] = {color1,color2};
			}
	store.set({ cats:cats, sectionColors:sectionColors });
	}
function onstate({ changed, current, previous }) {
			// this fires before oncreate, and on every state change.
			// the first time it runs, `previous` is undefined
			if (changed.snippets) {
				console.log('hey snippets have changed');
			}
	}
const file$1 = "src\\components\\Menu.html";

function create_main_fragment$1(component, ctx) {
	var div, text, text_1, nav, ul;

	var each_value = ctx.cats;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
	}

	return {
		c: function create() {
			div = createElement("div");
			text = createText("Shroud Alaska Group");
			text_1 = createText("\r\n\r\n");
			nav = createElement("nav");
			ul = createElement("ul");

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
			div.className = "topTitle";
			addLoc(div, file$1, 0, 0, 0);
			addLoc(ul, file$1, 3, 2, 61);
			addLoc(nav, file$1, 2, 0, 51);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(text, div);
			insertNode(text_1, target, anchor);
			insertNode(nav, target, anchor);
			appendNode(ul, nav);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}
		},

		p: function update(changed, ctx) {
			if (changed.cats) {
				each_value = ctx.cats;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
				detachNode(text_1);
				detachNode(nav);
			}

			destroyEach(each_blocks, detach);
		}
	};
}

// (5:1) {#each cats as cat}
function create_each_block(component, ctx) {
	var li, text_value = ctx.cat[1].menu, text, li_data_id_value;

	var link_initial_data = { href: "/topics/" + ctx.cat[0] };
	var link = new Link({
		root: component.root,
		store: component.store,
		slots: { default: createFragment() },
		data: link_initial_data
	});

	return {
		c: function create() {
			li = createElement("li");
			text = createText(text_value);
			link._fragment.c();
			li.dataset.id = li_data_id_value = ctx.cat[0];
			addLoc(li, file$1, 5, 3, 92);
		},

		m: function mount(target, anchor) {
			insertNode(li, target, anchor);
			appendNode(text, link._slotted.default);
			link._mount(li, null);
		},

		p: function update(changed, ctx) {
			if ((changed.cats) && text_value !== (text_value = ctx.cat[1].menu)) {
				text.data = text_value;
			}

			var link_changes = {};
			if (changed.cats) link_changes.href = "/topics/" + ctx.cat[0];
			link._set(link_changes);

			if ((changed.cats) && li_data_id_value !== (li_data_id_value = ctx.cat[0])) {
				li.dataset.id = li_data_id_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(li);
			}

			link.destroy();
		}
	};
}

function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.cat = list[i];
	child_ctx.each_value = list;
	child_ctx.cat_index = i;
	return child_ctx;
}

function Menu(options) {
	this._debugName = '<Menu>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data$1(), options.data);
	if (!('cats' in this._state)) console.warn("<Menu> was created without expected data property 'cats'");
	this._intro = true;

	this._handlers.state = [onstate];

	if (!options.root) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$1(this, this._state);

	this.root._oncreate.push(() => {
		onstate.call(this, { changed: assignTrue({}, this._state), current: this._state });
		oncreate.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign(Menu.prototype, protoDev);
assign(Menu.prototype, methods$1);

Menu.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

function Store(state, options) {
	this._handlers = {};
	this._dependents = [];

	this._computed = blankObject();
	this._sortedComputedProperties = [];

	this._state = assign({}, state);
	this._differs = options && options.immutable ? _differsImmutable : _differs;
}

assign(Store.prototype, {
	_add(component, props) {
		this._dependents.push({
			component: component,
			props: props
		});
	},

	_init(props) {
		const state = {};
		for (let i = 0; i < props.length; i += 1) {
			const prop = props[i];
			state['$' + prop] = this._state[prop];
		}
		return state;
	},

	_remove(component) {
		let i = this._dependents.length;
		while (i--) {
			if (this._dependents[i].component === component) {
				this._dependents.splice(i, 1);
				return;
			}
		}
	},

	_set(newState, changed) {
		const previous = this._state;
		this._state = assign(assign({}, previous), newState);

		for (let i = 0; i < this._sortedComputedProperties.length; i += 1) {
			this._sortedComputedProperties[i].update(this._state, changed);
		}

		this.fire('state', {
			changed,
			previous,
			current: this._state
		});

		const dependents = this._dependents.slice(); // guard against mutations
		for (let i = 0; i < dependents.length; i += 1) {
			const dependent = dependents[i];
			const componentState = {};
			let dirty = false;

			for (let j = 0; j < dependent.props.length; j += 1) {
				const prop = dependent.props[j];
				if (prop in changed) {
					componentState['$' + prop] = this._state[prop];
					dirty = true;
				}
			}

			if (dirty) dependent.component.set(componentState);
		}

		this.fire('update', {
			changed,
			previous,
			current: this._state
		});
	},

	_sortComputedProperties() {
		const computed = this._computed;
		const sorted = this._sortedComputedProperties = [];
		const visited = blankObject();
		let currentKey;

		function visit(key) {
			const c = computed[key];

			if (c) {
				c.deps.forEach(dep => {
					if (dep === currentKey) {
						throw new Error(`Cyclical dependency detected between ${dep} <-> ${key}`);
					}

					visit(dep);
				});

				if (!visited[key]) {
					visited[key] = true;
					sorted.push(c);
				}
			}
		}

		for (const key in this._computed) {
			visit(currentKey = key);
		}
	},

	compute(key, deps, fn) {
		let value;

		const c = {
			deps,
			update: (state, changed, dirty) => {
				const values = deps.map(dep => {
					if (dep in changed) dirty = true;
					return state[dep];
				});

				if (dirty) {
					const newValue = fn.apply(null, values);
					if (this._differs(newValue, value)) {
						value = newValue;
						changed[key] = true;
						state[key] = value;
					}
				}
			}
		};

		this._computed[key] = c;
		this._sortComputedProperties();

		const state = assign({}, this._state);
		const changed = {};
		c.update(state, changed, true);
		this._set(state, changed);
	},

	fire,

	get,

	on,

	set(newState) {
		const oldState = this._state;
		const changed = this._changed = {};
		let dirty = false;

		for (const key in newState) {
			if (this._computed[key]) throw new Error(`'${key}' is a read-only property`);
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._set(newState, changed);
	}
});

/* src\pages\index\index.html generated by Svelte v2.8.0 */

var methods$2 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

const file$2 = "src\\pages\\index\\index.html";

function create_main_fragment$2(component, ctx) {
	var div;

	return {
		c: function create() {
			div = createElement("div");
			div.className = "content is-medium home svelte-ziporw";
			addLoc(div, file$2, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
		},

		p: noop,

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

function Index(options) {
	this._debugName = '<Index>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign({}, options.data);
	this._intro = true;

	this._fragment = create_main_fragment$2(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Index.prototype, protoDev);
assign(Index.prototype, methods$2);

Index.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

class IndexHandler {
  get route() {
    return {
      enter(current, previous) {
        this.component = new Index({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        });
        console.log('Entered index!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left index!');
      }
    }
  }
}

function fade ( node, ref ) {
	var delay = ref.delay; if ( delay === void 0 ) delay = 0;
	var duration = ref.duration; if ( duration === void 0 ) duration = 400;

	var o = +getComputedStyle( node ).opacity;

	return {
		delay: delay,
		duration: duration,
		css: function (t) { return ("opacity: " + (t * o)); }
	};
}

/* src\pages\post-details\post-details.html generated by Svelte v2.8.0 */

function colors({ $sectionColors, $id }) {
	return $sectionColors[$id]
}

function snips({ $snippets, $id }) {
        /* could not figure out how to chaing these ! :(  */
	  $snippets.map((snip,idx) => { 
		snip.idx = idx;
	  });
	  return $snippets.filter((snip,idx) => snip.cat === $id);
}

function details({ $id, $cats }) {
 return $cats.filter(category => category[0] === $id)[0];
}

var methods$3 = {
		scrollTag(id) {
			const elmnt = document.getElementById(id);
			elmnt.scrollIntoView();	
		},
		addH2Tags() {
			const lesson = document.getElementsByClassName('lesson')[0];
			const tags = lesson.getElementsByTagName('h2');
			let i = 0;
			let arr = [];
			for (let tag of tags) {
				let tagId = 'h2_'+i;
				tag.id = tagId;
				i++;
				arr.push({text: tag.textContent, id: tagId });	
			}
			this.set({ lessonTags: arr });
		}
};

function oncreate$1() {


	const state = store.get();
	const id = state.id;
	const comp = this;
	const elmnt = document.getElementById("postWrap");
	elmnt.scrollIntoView();	

	const urly = `../posts/${ id }.html`;
	return fetch(urly).then(function(res) {
	return res.text();
		})
		.then(function(html) {
			// html = html.replace(/[\r\n\t]/g, '');
			// html = html.replace(/@@/g, '\n');
			//html = html.replace(/<\/pre>/g, '</pre><div class="cns"></div')
			comp.set({'desc':html});
			comp.addH2Tags(); 

			/* adds our bg colors to spans so we have colorful headings in sections */

			const sections = document.querySelectorAll('.lesson > p > span');
			const lightCols = ['rgb(236, 240, 32)','rgb(255, 208, 113)'];

			sections.forEach(function(section) {
				let { colors } = comp.get();
				if (!colors) colors = {};
				let col = colors.color1 || 'red';
				section.style.backgroundColor = col;

				if (lightCols.includes(col)){
					section.style.color = '#000';
				}
				//section.insertAdjacentHTML('beforeBegin', '<hr />');
			});
		});

	}
function store_1() {
	return store;
}

const file$3 = "src\\pages\\post-details\\post-details.html";

function create_main_fragment$3(component, ctx) {
	var div, text, div_1, text_1, div_transition, current;

	var if_block = (ctx.details) && create_if_block(component, ctx);

	var if_block_1 = (ctx.lessonTags) && create_if_block_1(component, ctx);

	function select_block_type(ctx) {
		if (ctx.details[0] == 'event') return create_if_block_2;
		return create_if_block_3;
	}

	var current_block_type = select_block_type(ctx);
	var if_block_2 = current_block_type(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			if (if_block) if_block.c();
			text = createText("\r\n\r\n\r\n\r\n");
			div_1 = createElement("div");
			if (if_block_1) if_block_1.c();
			text_1 = createText("\r\n\r\n\t");
			if_block_2.c();
			div_1.className = "content is-large desc";
			addLoc(div_1, file$3, 7, 0, 172);
			div.id = "postWrap";
			div.className = "content is-medium svelte-2rw6gw";
			addLoc(div, file$3, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			if (if_block) if_block.m(div, null);
			appendNode(text, div);
			appendNode(div_1, div);
			if (if_block_1) if_block_1.m(div_1, null);
			appendNode(text_1, div_1);
			if_block_2.m(div_1, null);
			current = true;
		},

		p: function update(changed, ctx) {
			if (ctx.details) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block(component, ctx);
					if_block.c();
					if_block.m(div, text);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (ctx.lessonTags) {
				if (if_block_1) {
					if_block_1.p(changed, ctx);
				} else {
					if_block_1 = create_if_block_1(component, ctx);
					if_block_1.c();
					if_block_1.m(div_1, text_1);
				}
			} else if (if_block_1) {
				if_block_1.d(1);
				if_block_1 = null;
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block_2) {
				if_block_2.p(changed, ctx);
			} else {
				if_block_2.d(1);
				if_block_2 = current_block_type(component, ctx);
				if_block_2.c();
				if_block_2.m(div_1, null);
			}
		},

		i: function intro(target, anchor) {
			if (current) return;
			if (component.root._intro) {
				if (div_transition) div_transition.invalidate();

				component.root._aftercreate.push(() => {
					if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, true);
					div_transition.run(1);
				});
			}
			this.m(target, anchor);
		},

		o: function outro(outrocallback) {
			if (!current) return;

			if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, false);
			div_transition.run(0, () => {
				outrocallback();
				div_transition = null;
			});

			current = false;
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
			if (if_block_1) if_block_1.d();
			if_block_2.d();
		}
	};
}

// (2:0) {#if details}
function create_if_block(component, ctx) {
	var h1, text_value = ctx.details[1].menu, text;

	return {
		c: function create() {
			h1 = createElement("h1");
			text = createText(text_value);
			h1.id = "post";
			setStyle(h1, "background-color", ctx.colors.color1);
			h1.className = "svelte-2rw6gw";
			addLoc(h1, file$3, 2, 2, 80);
		},

		m: function mount(target, anchor) {
			insertNode(h1, target, anchor);
			appendNode(text, h1);
		},

		p: function update(changed, ctx) {
			if ((changed.details) && text_value !== (text_value = ctx.details[1].menu)) {
				text.data = text_value;
			}

			if (changed.colors) {
				setStyle(h1, "background-color", ctx.colors.color1);
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(h1);
			}
		}
	};
}

// (10:2) {#each lessonTags as tag}
function create_each_block$1(component, ctx) {
	var span, text_value = ctx.tag.text, text;

	return {
		c: function create() {
			span = createElement("span");
			text = createText(text_value);
			span._svelte = { component, ctx };

			addListener(span, "click", click_handler);
			span.className = "tag";
			addLoc(span, file$3, 10, 2, 259);
		},

		m: function mount(target, anchor) {
			insertNode(span, target, anchor);
			appendNode(text, span);
		},

		p: function update(changed, ctx) {
			if ((changed.lessonTags) && text_value !== (text_value = ctx.tag.text)) {
				text.data = text_value;
			}

			span._svelte.ctx = ctx;
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(span);
			}

			removeListener(span, "click", click_handler);
		}
	};
}

// (9:1) {#if lessonTags}
function create_if_block_1(component, ctx) {
	var each_anchor;

	var each_value = ctx.lessonTags;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(component, get_each_context$1(ctx, each_value, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.lessonTags) {
				each_value = ctx.lessonTags;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$1(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

// (17:1) {#if details[0] == 'event'}
function create_if_block_2(component, ctx) {
	var div, raw_after, text, iframe;

	return {
		c: function create() {
			div = createElement("div");
			raw_after = createElement('noscript');
			text = createText(" \r\n\t\t");
			iframe = createElement("iframe");
			iframe.sandbox = "allow-forms allow-scripts";
			iframe.src = "https://www.tickettailor.com/events/allsaintschurch";
			setAttribute(iframe, "frameborder", "0");
			iframe.className = "svelte-2rw6gw";
			addLoc(iframe, file$3, 19, 2, 428);
			div.className = "lesson";
			addLoc(div, file$3, 17, 1, 387);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(raw_after, div);
			raw_after.insertAdjacentHTML("beforebegin", ctx.desc);
			appendNode(text, div);
			appendNode(iframe, div);
		},

		p: function update(changed, ctx) {
			if (changed.desc) {
				detachBefore(raw_after);
				raw_after.insertAdjacentHTML("beforebegin", ctx.desc);
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

// (23:1) {:else}
function create_if_block_3(component, ctx) {
	var section;

	return {
		c: function create() {
			section = createElement("section");
			addLoc(section, file$3, 23, 1, 583);
		},

		m: function mount(target, anchor) {
			insertNode(section, target, anchor);
			section.innerHTML = ctx.desc;
		},

		p: function update(changed, ctx) {
			if (changed.desc) {
				section.innerHTML = ctx.desc;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(section);
			}
		}
	};
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.tag = list[i];
	child_ctx.each_value = list;
	child_ctx.tag_index = i;
	return child_ctx;
}

function click_handler(event) {
	const { component, ctx } = this._svelte;

	component.scrollTag(ctx.tag.id);
}

function Post_details(options) {
	this._debugName = '<Post_details>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this.store = store_1();
	this._state = assign(this.store._init(["sectionColors","id","snippets","cats"]), options.data);
	this.store._add(this, ["sectionColors","id","snippets","cats"]);
	this._recompute({ $sectionColors: 1, $id: 1, $snippets: 1, $cats: 1 }, this._state);
	if (!('$sectionColors' in this._state)) console.warn("<Post_details> was created without expected data property '$sectionColors'");
	if (!('$id' in this._state)) console.warn("<Post_details> was created without expected data property '$id'");
	if (!('$snippets' in this._state)) console.warn("<Post_details> was created without expected data property '$snippets'");
	if (!('$cats' in this._state)) console.warn("<Post_details> was created without expected data property '$cats'");


	if (!('lessonTags' in this._state)) console.warn("<Post_details> was created without expected data property 'lessonTags'");
	if (!('desc' in this._state)) console.warn("<Post_details> was created without expected data property 'desc'");
	this._intro = true;

	this._handlers.destroy = [removeFromStore];

	if (!options.root) {
		this._oncreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$3(this, this._state);

	this.root._oncreate.push(() => {
		oncreate$1.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		callAll(this._oncreate);
		callAll(this._aftercreate);
	}
}

assign(Post_details.prototype, protoDev);
assign(Post_details.prototype, methods$3);

Post_details.prototype._checkReadOnly = function _checkReadOnly(newState) {
	if ('colors' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'colors'");
	if ('snips' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'snips'");
	if ('details' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'details'");
};

Post_details.prototype._recompute = function _recompute(changed, state) {
	if (changed.$sectionColors || changed.$id) {
		if (this._differs(state.colors, (state.colors = colors(state)))) changed.colors = true;
	}

	if (changed.$snippets || changed.$id) {
		if (this._differs(state.snips, (state.snips = snips(state)))) changed.snips = true;
	}

	if (changed.$id || changed.$cats) {
		if (this._differs(state.details, (state.details = details(state)))) changed.details = true;
	}
};

class PostDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
     
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id});
    
        this.component = new Post_details({
          target: document.getElementById('app'),
          data: {
            desc: '',
            lessonTags: []
          }
        });
       // console.log('Entered post details!');
      },
      leave(current, previous) {
        this.component.destroy();
      //  console.log('Left post details!');
      }
    }
  }
}

class Routes {
  constructor() {
    this.router = roadtrip;
    this.init();
  }

  init() {
    this.index_handler = new IndexHandler();
   // this.snippets_handler = new SnippetsHandler();
   // this.snippet_details_handler = new SnippetDetailsHandler();
    this.post_details_handler = new PostDetailsHandler();

    this.router
      .add('/', this.index_handler.route)
     // .add('/snippets', this.snippets_handler.route)
     // .add('/snippets/:id', this.snippet_details_handler.route)  
      .add('/topics/:id', this.post_details_handler.route)         
      .start({
        fallback: '/'
      });
  }
}

/*
 * This is the entrypoint of all the JavaScript files.
 */
//import './styles/_color_nav.css';


//const baseUrl = 'http://localhost:5100/';
//const baseUrl = 'https://es6.kwippe.com/';
//const urly = baseUrl+ 'data/snippets.json'
  
const store$1 = new Store({
  snippets: []
});

// fetch(urly)
//   .then(res => res.json())
//   .then(data => {
//      const snippets = data.snippets;
//      store.set({baseUrl: baseUrl, snippets: snippets });
//     // console.table(store.get())
//   });  

document.addEventListener('DOMContentLoaded', main);

function main () {
  window.Routes = new Routes();

    // const nav = new Nav({
    //     target: document.getElementById('nav'),
    //     store
    // })

    const menu = new Menu({
      target: document.getElementById('menu'),
      store: store$1
    });

}
window.store = store$1; // useful for debugging!

}());
//# sourceMappingURL=bundle.js.map
